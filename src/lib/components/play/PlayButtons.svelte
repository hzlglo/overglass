<script lang="ts">
  import type { MidiMapping } from '$lib/database/schema';
  import { MidiPlayer } from '$lib/database/services/midiPlayer';
  import { trackDb, useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import { CircleQuestionMarkIcon, PlayIcon, SquareIcon } from '@lucide/svelte';
  import classNames from 'classnames';
  import { has } from 'lodash';
  import { WebMidi, type Output } from 'webmidi';
  import Popover from '../core/Popover.svelte';
  import Tooltip from '../core/Tooltip.svelte';
  import DeviceMapper from './DeviceMapper.svelte';
  import { sendMidiControlChange } from './midiHelpers';
  import { playState } from './playState.svelte';

  let midiOutputs = $state<Output[]>([]);
  let trackDevicesStore = useTrackDbQuery((trackDb) => trackDb.devices.getDevicesWithTracks(), []);
  let trackDevices = $derived(trackDevicesStore.getResult());
  let deviceToMidiOutputMapping = $state<Record<string, string | undefined>>({});
  $effect(() => {
    for (const trackDevice of trackDevices) {
      if (!has(deviceToMidiOutputMapping, trackDevice.deviceName)) {
        let defaultMidiOutput = undefined;
        if (midiOutputs.length === 1) {
          defaultMidiOutput = midiOutputs[0].name;
        }
        deviceToMidiOutputMapping[trackDevice.deviceName] = defaultMidiOutput;
      }
    }
  });
  let deviceToMidiOutput: Record<string, Output | undefined> = $derived(
    Object.fromEntries(
      Object.entries(deviceToMidiOutputMapping).map(([deviceName, midiOutputName]) => [
        deviceName,
        midiOutputs.find((o) => o.name === midiOutputName),
      ]),
    ),
  );

  let isPlaying = $derived(playState.getIsPlaying());
  let audioCtx = $state<AudioContext | null>(null);
  // represents the starting point of play in song time seconds (0 is the start of the song)
  let startTime = $state(0);
  // represents the next message batch to be send, in song time seconds
  let nextMessageBatchStart = $state(0);

  type PlayFunctionArgs = {
    startTime: number;
    endTime: number;
    isBeginningPlay: boolean;
  };

  let playFunctions: ((args: PlayFunctionArgs) => Promise<any>)[] = $state.raw([]);

  const LOOKAHEAD = 0.5;
  const GRANULARITY = 0.1;

  async function handlePlay() {
    playState.setHasClickedPlay(true);
    if (isPlaying) return;
    await WebMidi.enable();
    midiOutputs = WebMidi.outputs;

    const midiPlayer = new MidiPlayer(trackDb.get());

    const midiMappings: (MidiMapping & {
      id: string;
      trackId: string;
      trackNumber: number;
      deviceName: string;
      isMute: boolean;
    })[] = await trackDb.get().run(`
      SELECT 
        parameters.id as id,
        tracks.id as track_id,
        tracks.track_number as track_number,
        devices.device_name as device_name,
        parameters.is_mute,
        midi_mappings.*,
      FROM parameters
      JOIN tracks on parameters.track_id = tracks.id
      JOIN devices on tracks.device_id = devices.id
      JOIN midi_mappings on parameters.original_parameter_id = midi_mappings.param_id and devices.device_name = midi_mappings.device
      `);

    await Promise.all(
      midiMappings.map(async (midiMapping) => {
        const midiOutput = deviceToMidiOutput[midiMapping.deviceName];
        if (!midiOutput) {
          console.error(
            'Failed to play mute transitions for track - no midi output found',
            midiMapping,
          );
          return;
        }

        if (midiMapping.isMute) {
          playFunctions.push(async ({ startTime, endTime, isBeginningPlay }) => {
            const muteTransitions = await midiPlayer.getMuteTransitionsToPlay(
              midiMapping.trackId,
              startTime,
              endTime,
              isBeginningPlay,
            );
            if (midiMapping.trackNumber === 11) {
              console.log('Mute transitions', muteTransitions);
            }
            return Promise.all(
              muteTransitions.map(async (m) =>
                sendMidiControlChange({
                  output: midiOutput,
                  midiMapping,
                  value: m.isMuted ? 1 : 0,
                  channel: midiMapping.trackNumber,
                  time: m.timePosition,
                }),
              ),
            );
          });
        } else {
          playFunctions.push(async ({ startTime, endTime, isBeginningPlay }: PlayFunctionArgs) => {
            const automation = await midiPlayer.getInterpolatedValuesToPlay({
              parameterId: midiMapping.id,
              startTime: startTime,
              endTime: endTime,
              granularity: GRANULARITY,
              isBeginningPlay: isBeginningPlay,
            });
            return Promise.all(
              automation.map(async (a) =>
                sendMidiControlChange({
                  output: midiOutput,
                  midiMapping,
                  value: a.value,
                  channel: midiMapping.trackNumber,
                  time: a.timePosition,
                }),
              ),
            );
          });
        }
      }),
    );

    // Create audio context clock
    playState.setIsPlaying(true);
    audioCtx = new AudioContext();
    startTime = playState.getPlayPoint();
    console.log('Play timer: starting at', startTime);

    // start playing
    await Promise.all(
      playFunctions.map((playFunction) => {
        return playFunction({
          startTime,
          endTime: startTime + LOOKAHEAD * 2,
          isBeginningPlay: true,
        });
      }),
    );
    // todo when should this be continue vs start?
    midiOutputs.forEach((midiOutput) => {
      midiOutput.sendStart();
    });
    console.log(
      'Play timer: first messages sent at',
      audioCtx.currentTime,
      'latency:',
      audioCtx.currentTime,
    );
    nextMessageBatchStart = startTime + LOOKAHEAD * 2;

    // Start scheduler loop
    scheduleLoop();
  }

  async function scheduleLoop() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    console.log('Play timer: loop for', nextMessageBatchStart, 'running at ', startTime + now);
    if (now > nextMessageBatchStart - startTime) {
      console.error('Play timer: behind schedule, updating nextMessageBatchStart to', now);
      nextMessageBatchStart = startTime + now;
    }

    await Promise.all(
      playFunctions.map((playFunction) => {
        return playFunction({
          startTime: nextMessageBatchStart,
          endTime: nextMessageBatchStart + LOOKAHEAD,
          isBeginningPlay: false,
        });
      }),
    );
    const latency = audioCtx.currentTime - now;
    console.log(
      'Play timer: messages for ',
      nextMessageBatchStart,
      'sent at ',
      audioCtx.currentTime + startTime,
      'latency:',
      latency,
    );
    nextMessageBatchStart += LOOKAHEAD;

    playState.setPlayPoint(startTime + audioCtx.currentTime);

    // Keep looping until stopped
    if (isPlaying) {
      if (latency > LOOKAHEAD) {
        scheduleLoop();
      } else {
        setTimeout(() => scheduleLoop(), (LOOKAHEAD - latency) * 1000);
      }
    }
  }

  async function stopPlayback() {
    midiOutputs.forEach((midiOutput) => {
      midiOutput.sendStop();
    });
    playState.setIsPlaying(false);
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    startTime = 0;
    nextMessageBatchStart = 0;
    playFunctions = [];
  }
  let playContainerListeners = (ref: HTMLButtonElement) => {
    if (!ref) return;
    ref.addEventListener('keydown', async (event) => {
      if (event.code.toLowerCase() === 'space') {
        if (isPlaying) {
          await stopPlayback();
        } else {
          await handlePlay();
        }
        event.preventDefault();
      }
    });
  };
</script>

<div class="flex w-[300px] flex-row items-center gap-2">
  <button
    class={classNames('btn btn-sm btn-square', isPlaying ? 'btn-success' : 'btn-ghost')}
    onclick={handlePlay}
    use:playContainerListeners
  >
    <PlayIcon />
  </button>
  {#if playState.getHasClickedPlay()}
    <button
      class="btn btn-sm btn-square btn-ghost"
      onclick={stopPlayback}
      use:playContainerListeners
    >
      <SquareIcon />
    </button>
    {#if midiOutputs.length === 0}
      <span class="text-error">No MIDI input found</span>
    {:else}
      <Popover>
        {#snippet content()}
          <DeviceMapper
            {midiOutputs}
            {trackDevices}
            deviceToMidiOutput={deviceToMidiOutputMapping}
          />
        {/snippet}
        <span class="text-success">
          {midiOutputs.length} MIDI {midiOutputs.length === 1 ? 'device' : 'devices'} found
        </span>
      </Popover>
    {/if}
    <Tooltip>
      {#snippet content()}
        <div class="bg-base-100 border-base-content/20 border p-2 text-sm">
          <p>If you encounter any issues, please ensure your device</p>
          <ul class="list-inside list-disc">
            <li>Is connected via USB</li>
            <li>Has MIDI enabled</li>
            <li>Has Transport Receive enabled</li>
            <li>Has Clock Receive disabled</li>
            <li>Each track is mapped to the corresponding MIDI channel</li>
          </ul>
        </div>
      {/snippet}
      <CircleQuestionMarkIcon />
    </Tooltip>
  {/if}
</div>

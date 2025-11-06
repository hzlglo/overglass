<script lang="ts">
  import type { MidiMapping } from '$lib/database/schema';
  import { MidiPlayer } from '$lib/database/services/midiPlayer';
  import { trackDb, useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import { PlayIcon, SquareIcon } from '@lucide/svelte';
  import classNames from 'classnames';
  import { has } from 'lodash';
  import { WebMidi, type Output } from 'webmidi';
  import Popover from '../core/Popover.svelte';
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

  const LOOKAHEAD = 0.25;
  const GRANULARITY = 0.1;

  async function handlePlay() {
    playState.setHasClickedPlay(true);
    if (isPlaying) return;
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
        midi_mappings.* EXCLUDE (id),
      FROM parameters
      JOIN tracks on parameters.track_id = tracks.id
      JOIN devices on tracks.device_id = devices.id
      JOIN midi_mappings on parameters.vst_parameter_id = midi_mappings.param_id and devices.device_name = midi_mappings.device
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
            const currentTime = WebMidi.time;
            return Promise.all(
              muteTransitions.map(async (m) =>
                sendMidiControlChange({
                  output: midiOutput,
                  midiMapping,
                  value: m.isMuted ? 1 : 0,
                  channel: midiMapping.trackNumber,
                  time: currentTime + (m.timePosition - startTime) * 1000,
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
            const currentTime = WebMidi.time;
            return Promise.all(
              automation.map(async (a) =>
                sendMidiControlChange({
                  output: midiOutput,
                  midiMapping,
                  value: a.value,
                  channel: midiMapping.trackNumber,
                  time: currentTime + (a.timePosition - startTime) * 1000,
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
  $effect(() => {
    if (!document) return;
    const listener = async (event: KeyboardEvent) => {
      const isTyping =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

      if (isTyping) return;
      if (event.code.toLowerCase() === 'space') {
        console.log('Play button: space pressed', isPlaying);
        if (isPlaying) {
          await stopPlayback();
        } else {
          await handlePlay();
        }
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  });
</script>

<div class="flex flex-row items-center">
  {#if midiOutputs.length === 0}
    <button
      class="btn btn-square btn-outline btn-success"
      title="Play the project via MIDI"
      onclick={async () => {
        await WebMidi.enable();
        midiOutputs = WebMidi.outputs;
        midiOutputs.forEach((midiOutput) => {
          const matchingDevice = trackDevices.find(
            (device) =>
              device.deviceName.includes(midiOutput.name) ||
              midiOutput.name.includes(device.deviceName),
          );
          if (matchingDevice) {
            deviceToMidiOutputMapping[matchingDevice.deviceName] = midiOutput.name;
          }
        });
        handlePlay();
      }}
    >
      <PlayIcon />
    </button>
  {:else}
    <button
      class={classNames('btn btn-square btn-success btn-outline')}
      onclick={() => (isPlaying ? stopPlayback() : handlePlay())}
      title={isPlaying ? 'Stop playback' : 'Play the project via MIDI'}
    >
      {#if isPlaying}
        <SquareIcon />
      {:else}
        <PlayIcon />
      {/if}
    </button>
  {/if}

  <Popover>
    {#snippet content()}
      <div class="bg-base-100 border-base-content/20 border p-4 text-sm">
        <p>If you encounter any playback issues, please ensure your device</p>
        <ul class="list-inside list-disc">
          <li>Is connected via USB</li>
          <li>Has MIDI enabled</li>
          <li>Has Transport Receive enabled</li>
          <li>Has Clock Receive disabled</li>
          <li>Each track is mapped to the corresponding MIDI channel</li>
        </ul>
        <p class="my-4 font-semibold">Available MIDI devices:</p>
        <DeviceMapper {midiOutputs} {trackDevices} deviceToMidiOutput={deviceToMidiOutputMapping} />
      </div>
    {/snippet}
    <button class="btn btn-link text-base-content btn-sm"
      >{#if midiOutputs.length > 0}
        <span class="status status-success"></span>{midiOutputs.length}
        {midiOutputs.length === 1 ? 'device' : 'devices'}
      {:else}MIDI Setup
      {/if}</button
    >
  </Popover>
</div>

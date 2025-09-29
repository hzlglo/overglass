<script lang="ts">
  import { ElektronNameMatcher } from '$lib/config/regex';
  import { MidiPlayer } from '$lib/database/services/midiPlayer';
  import { MUTE_PARAMETER_NAME } from '$lib/stores/midiMapping';
  import { midiStore } from '$lib/stores/midiStore.svelte';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import Tooltip from '../core/Tooltip.svelte';
  import { CircleQuestionMarkIcon, PlayIcon, SquareIcon } from '@lucide/svelte';
  import { keyBy } from 'lodash';
  import { WebMidi, type Output } from 'webmidi';
  import { playState } from './playState.svelte';
  import classNames from 'classnames';

  let midiDevices = $state<Output[]>([]);
  let hasClickedPlay = $state(false);
  let isPlaying = $state(false);
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

  let playFunctions: ((args: PlayFunctionArgs) => Promise<void>)[] = $state.raw([]);

  const LOOKAHEAD = 0.1;
  const GRANULARITY = 0.02;

  async function sendMidiControlChange(
    output: Output,
    args: Parameters<Output['sendControlChange']>,
    logMessage: string,
  ) {
    console.log('Sending MIDI control change', output.name, logMessage, args);
    output.sendControlChange(...args);
  }

  async function handlePlay() {
    hasClickedPlay = true;
    if (isPlaying) return;
    await WebMidi.enable();
    midiDevices = WebMidi.outputs;

    const [parameters, tracks] = await Promise.all([
      trackDb.get().tracks.getAllParameters(),
      trackDb.get().tracks.getAllTracks(),
    ]);
    const tracksById = keyBy(tracks, 'id');
    const midiPlayer = new MidiPlayer(trackDb.get());

    // add mute transitions to play functions
    tracks.forEach((t) => {
      const muteMapping = midiStore.getMidiChannel(t.deviceName, MUTE_PARAMETER_NAME);
      if (!muteMapping) {
        console.error('Failed to play mute transitions for track - no mapping found', t);
        return;
      }
      playFunctions.push(async ({ startTime, endTime, isBeginningPlay }) => {
        const muteTransitions = await midiPlayer.getMuteTransitionsToPlay(
          t.id,
          startTime,
          endTime,
          isBeginningPlay,
        );
        for (const m of muteTransitions) {
          sendMidiControlChange(
            midiDevices[0],
            [
              muteMapping,
              m.isMuted ? 127 : 0,
              {
                channels: t.trackNumber,
                time: m.timePosition,
              },
            ],
            'mute control change',
          );
        }
        return;
      });
    });

    // add automation to play functions
    parameters
      .filter((p) => !p.isMute)
      .forEach((p) => {
        const track = tracksById[p.trackId];
        if (!track) {
          console.error('Failed to play automation for parameter - no track found', p);
          return;
        }
        const mapping = midiStore.getMidiChannel(
          track.deviceName,
          ElektronNameMatcher.cleanParameterName(p.parameterName),
        );
        if (!mapping) {
          console.error('Failed to play automation for parameter - no mapping found', p);
          return;
        }
        playFunctions.push(async ({ startTime, endTime, isBeginningPlay }: PlayFunctionArgs) => {
          const automation = await midiPlayer.getInterpolatedValuesToPlay({
            parameterId: p.id,
            startTime: startTime,
            endTime: endTime,
            granularity: GRANULARITY,
            isBeginningPlay: isBeginningPlay,
          });
          for (const a of automation) {
            sendMidiControlChange(
              midiDevices[0],
              [
                mapping,
                Math.round(a.value * 127),
                {
                  channels: track.trackNumber,
                  time: a.timePosition,
                },
              ],
              'automation control change',
            );
          }
          return;
        });
      });

    // Create audio context clock
    isPlaying = true;
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
    midiDevices[0].sendStart();
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
      setTimeout(() => scheduleLoop(), (LOOKAHEAD - latency) * 1000);
    }
  }

  async function stopPlayback() {
    midiDevices[0].sendStop();
    isPlaying = false;
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    startTime = 0;
    nextMessageBatchStart = 0;
    playFunctions = [];
  }
</script>

<div class="flex w-[300px] flex-row items-center gap-2">
  <button
    class={classNames('btn btn-sm btn-square', isPlaying ? 'btn-success' : 'btn-ghost')}
    onclick={handlePlay}
  >
    <PlayIcon />
  </button>
  {#if hasClickedPlay}
    <button class="btn btn-sm btn-square btn-ghost" onclick={stopPlayback}>
      <SquareIcon />
    </button>
    {#if midiDevices.length === 0}
      <span class="text-error">No MIDI input found</span>
    {:else}
      <Tooltip contentString={midiDevices.map((device) => device.name).join(', ')}>
        <span class="text-success">
          {midiDevices.length} MIDI {midiDevices.length === 1 ? 'device' : 'devices'} found
        </span>
      </Tooltip>
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
          </ul>
        </div>
      {/snippet}
      <CircleQuestionMarkIcon />
    </Tooltip>
  {/if}
</div>

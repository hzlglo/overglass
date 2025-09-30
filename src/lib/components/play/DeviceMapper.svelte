<script lang="ts">
  import type { Device } from '$lib/database/schema';
  import type { Output } from 'webmidi';
  import Select from '../core/Select.svelte';

  let {
    midiOutputs,
    trackDevices,
    deviceToMidiOutput = $bindable(),
  }: {
    midiOutputs: Output[];
    trackDevices: Device[];
    deviceToMidiOutput: Record<string, string | undefined>;
  } = $props();
</script>

<div
  class="bg-base-100 border-base-content/20 rounded-box flex w-[500px] flex-1 flex-col gap-2 border p-4"
>
  {#each trackDevices as trackDevice}
    <div class="flex flex-1 flex-row flex-nowrap items-center justify-between">
      {trackDevice.deviceName}

      <Select
        triggerClass="min-w-[150px] min-h-[28px]"
        bind:value={deviceToMidiOutput[trackDevice.deviceName]}
        placeholder="Select a MIDI output"
        options={midiOutputs.map((midiDevice) => ({
          label: midiDevice.name,
          value: midiDevice.name,
        }))}
      />
    </div>
  {/each}
</div>

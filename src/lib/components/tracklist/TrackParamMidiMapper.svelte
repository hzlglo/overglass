<script lang="ts">
  import type { Device, Parameter } from '$lib/database/schema';
  import { midiStore } from '$lib/stores/midiStore.svelte';
  import { CheckIcon, CircleAlertIcon } from '@lucide/svelte';
  import classNames from 'classnames';
  import Autocomplete from '../core/Autocomplete.svelte';
  import { ElektronNameMatcher } from '$lib/config/regex';

  let { device, parameter }: { device: Device; parameter: Parameter } = $props();

  let isMappingMidiChannel = $state(false);
  let midiChannel = $derived(
    parameter
      ? midiStore.getMidiChannel(
          device.deviceName,
          ElektronNameMatcher.cleanParameterName(parameter.parameterName),
        )
      : null,
  );
  let deviceMapping = $derived(midiStore.getDeviceMapping(device.deviceName));
  let hasEditedMidiChannel = $state(false);
  let isAutocompleteOpen = $state(false);
  $effect(() => {
    if (isAutocompleteOpen) {
      isMappingMidiChannel = true;
    }
  });
  $inspect({
    isAutocompleteOpen,
    isMappingMidiChannel,
    deviceMapping,
    midiChannel,
    hasEditedMidiChannel,
  });
</script>

<div class={classNames('flex flex-row items-center justify-start gap-2')}>
  {#if !midiChannel}
    <div class="tooltip" data-tip="No MIDI channel mapped">
      <button
        class="btn btn-square btn-ghost btn-warning btn-xs"
        onclick={() => (isMappingMidiChannel = true)}
        ><CircleAlertIcon />
      </button>
    </div>
  {/if}
  <div
    class={classNames(
      'flex flex-row items-center gap-2 group-hover:block',
      isMappingMidiChannel || isAutocompleteOpen ? '' : 'hidden',
    )}
  >
    <Autocomplete
      bind:open={isAutocompleteOpen}
      placeholder={midiChannel ? `MIDI channel: ${midiChannel.toString()}` : ''}
      onchange={(mappingName) => {
        if (!deviceMapping) return;
        const mapping = deviceMapping[mappingName];
        midiStore.setMidiMappings(
          device.deviceName,
          ElektronNameMatcher.cleanParameterName(parameter.parameterName),
          mapping,
        );
        hasEditedMidiChannel = true;
        isAutocompleteOpen = false;
        isMappingMidiChannel = false;
      }}
      options={Object.entries(deviceMapping || {}).map(([key, mapping]) => ({
        label: `${key}: ${mapping.cc_msb}`,
        value: key,
      }))}
    />
  </div>
</div>

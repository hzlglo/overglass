<script lang="ts">
  import type { Device, Parameter } from '$lib/database/schema';
  import { midiStore } from '$lib/stores/midiStore.svelte';
  import { CircleAlertIcon } from '@lucide/svelte';
  import classNames from 'classnames';
  import Autocomplete from '../core/Autocomplete.svelte';
  import { ElektronNameMatcher } from '$lib/config/regex';
  import Tooltip from '../core/Tooltip.svelte';

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
  let isAutocompleteOpen = $state(false);
  $effect(() => {
    if (isAutocompleteOpen) {
      isMappingMidiChannel = true;
    }
  });
</script>

<div class={classNames('flex flex-row items-center justify-start gap-2')}>
  {#if !midiChannel}
    <Tooltip contentString="No MIDI channel mapped">
      <button
        class="btn btn-square btn-ghost btn-warning btn-xs"
        onclick={() => (isMappingMidiChannel = true)}
        ><CircleAlertIcon />
      </button>
    </Tooltip>
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

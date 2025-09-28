<script lang="ts">
  import { useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
  import LaneControl from './LaneControl.svelte';
  import { type TrackCustomization } from '$lib/stores/customization.svelte';
  import { ElektronNameMatcher } from '$lib/config/regex';
  import { midiStore } from '$lib/stores/midiStore.svelte';
  import type { Device } from '$lib/database/schema';
  import { CheckIcon, CircleAlertIcon } from '@lucide/svelte';
  import Autocomplete from '../core/Autocomplete.svelte';

  interface AutomationParameterProps {
    parameterId: string;
    trackConfig: TrackCustomization | null;
    device: Device;
  }

  let { parameterId, trackConfig, device }: AutomationParameterProps = $props();

  let parameterStore = useTrackDbQuery(
    (trackDb) => trackDb.tracks.getParameterById(parameterId),
    null,
  );
  let parameter = $derived(parameterStore.getResult());

  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));
  let getParameterDisplayName = (parameterName: string, trackConfig: TrackCustomization | null) => {
    if (!trackConfig || !trackConfig.userEnteredName) {
      return parameterName;
    }
    return `${trackConfig.userEnteredName} ${ElektronNameMatcher.cleanParameterName(parameterName)}`;
  };
  let isMappingMidiChannel = $state(false);
  let midiChannel = $derived(
    parameter ? midiStore.getMidiChannel(device.deviceName, parameter.parameterName) : null,
  );
  let deviceMapping = $derived(midiStore.getDeviceMapping(device.deviceName));
</script>

{#if parameter}
  <LaneControl
    title={getParameterDisplayName(parameter.parameterName, trackConfig)}
    {isExpanded}
    onToggleExpanded={() => gridDisplayState.toggleParameterExpansion(parameterId)}
    laneId={parameterId}
    color={trackConfig?.color}
  >
    {#snippet actions()}
      {#if isMappingMidiChannel}
        <div class="flex flex-row items-center justify-start gap-2">
          <span class="label">MIDI channel</span>
          <Autocomplete
            options={Object.entries(deviceMapping || {}).map(([key, mapping]) => ({
              label: key,
              onSelect: () => {
                console.log('onSelect', device.deviceName, parameter.parameterName, key, mapping);
                midiStore.setMidiMappings(device.deviceName, parameter.parameterName, mapping);
              },
            }))}
          />
          {#if midiChannel}
            <button
              class="btn btn-square btn-ghost btn-xs"
              onclick={() => {
                isMappingMidiChannel = false;
              }}
            >
              <CheckIcon />
            </button>
          {/if}
        </div>
      {/if}
      {#if !midiChannel}
        <div class="tooltip" data-tip="No MIDI channel mapped">
          <button
            class="btn btn-square btn-ghost btn-warning btn-xs"
            onclick={() => (isMappingMidiChannel = true)}
            ><CircleAlertIcon />
          </button>
        </div>
      {/if}
    {/snippet}
  </LaneControl>
{:else}
  <div class="text-error">Parameter not found</div>
{/if}

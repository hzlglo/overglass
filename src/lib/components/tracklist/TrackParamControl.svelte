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
  import classNames from 'classnames';
  import TrackParamMidiMapper from './TrackParamMidiMapper.svelte';

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
      <TrackParamMidiMapper {device} {parameter} />
    {/snippet}
  </LaneControl>
{:else}
  <div class="text-error">Parameter not found</div>
{/if}

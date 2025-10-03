<script lang="ts">
  import { ElektronNameMatcher } from '$lib/config/regex';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { sharedGridState } from '../grid/sharedGridState.svelte';
  import LaneControl from './LaneControl.svelte';
  import TrackParamMidiMapper from './TrackParamMidiMapper.svelte';

  interface AutomationParameterProps {
    parameterId: string;
  }

  let { parameterId }: AutomationParameterProps = $props();

  let parameterState = $derived(sharedGridState.getParameterState(parameterId));
  let trackConfig = $derived(
    appConfigStore.get()?.trackCustomizations[parameterState?.track.id ?? ''] ?? null,
  );
  let title = $derived.by(() => {
    if (!parameterState) {
      return '';
    }
    if (!trackConfig || !trackConfig.userEnteredName) {
      return parameterState.parameter.parameterName;
    }
    return `${trackConfig.userEnteredName} ${ElektronNameMatcher.cleanParameterName(parameterState.parameter.parameterName)}`;
  });
</script>

{#if parameterState}
  <LaneControl
    {title}
    isExpanded={parameterState.expanded}
    onToggleExpanded={() => sharedGridState.toggleParameterExpansion(parameterId)}
    laneId={parameterId}
    color={trackConfig?.color}
  >
    {#snippet actions()}
      <TrackParamMidiMapper device={parameterState.device} parameter={parameterState.parameter} />
    {/snippet}
  </LaneControl>
{:else}
  <div class="text-error">Parameter not found</div>
{/if}

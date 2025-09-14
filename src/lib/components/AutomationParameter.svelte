<script lang="ts">
  import type { Parameter, ParameterStats } from '$lib/database/schema';
  import AutomationCurve from './AutomationCurve.svelte';
  import { trackExpansionState } from './trackExpansionState.svelte';
  import TrackLane from './TrackLane.svelte';

  interface AutomationParameterProps {
    parameter: Parameter & ParameterStats;
  }

  let { parameter }: AutomationParameterProps = $props();

  let isExpanded = $derived(trackExpansionState.getParameterExpanded(parameter.id));
</script>

<TrackLane
  title={parameter.parameterName}
  {isExpanded}
  onToggleExpanded={() => trackExpansionState.toggleParameterExpansion(parameter.id)}
>
  {#snippet body()}
    <AutomationCurve
      parameterId={parameter.id}
      minValue={parameter.minValue}
      maxValue={parameter.maxValue}
    />
  {/snippet}
  {#snippet right()}{/snippet}
  {#snippet children()}{/snippet}
</TrackLane>

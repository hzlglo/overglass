<script lang="ts">
  import type { AutomationPoint } from '$lib/database/schema';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import AutomationCurve from './AutomationCurve.svelte';
  import { type ParameterLaneDisplay } from './sharedGridState.svelte';

  interface AutomationCurveWrapperProps {
    lane: ParameterLaneDisplay;
    width: number;
    automationPoints: AutomationPoint[];
  }

  let { lane, width, automationPoints }: AutomationCurveWrapperProps = $props();

  let parameter = $derived(lane.parameter);
  let isExpanded = $derived(lane.expanded);
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[lane.track.id] ?? null);
</script>

{#if parameter}
  {#if isExpanded}
    <AutomationCurve
      parameterId={lane.id}
      {parameter}
      height={lane.bottom - lane.top}
      {width}
      {automationPoints}
      color={trackConfig?.color}
    />
  {/if}
{:else}
  <g><text> {parameterId} Parameter not found</text></g>
{/if}

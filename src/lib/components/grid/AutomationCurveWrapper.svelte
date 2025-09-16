<script lang="ts">
  import type { AutomationPoint } from '$lib/database/schema';
  import type { TrackCustomization } from '$lib/stores/customization.svelte';
  import { automationDb } from '../../stores/database.svelte';
  import AutomationCurve from './AutomationCurve.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    height: number;
    width: number;
    yPosition: number;
    automationPoints: AutomationPoint[];
    trackCustomizations: Record<string, TrackCustomization>;
  }

  let {
    parameterId,
    height,
    width,
    yPosition,
    automationPoints,
    trackCustomizations,
  }: AutomationCurveProps = $props();
  let parameterPromise = $derived(automationDb.get().tracks.getParameterById(parameterId));
  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));
</script>

{#if isExpanded}
  {#await parameterPromise then parameter}
    {#if parameter}
      <AutomationCurve
        {parameterId}
        {parameter}
        {height}
        {width}
        {yPosition}
        {automationPoints}
        color={trackCustomizations[parameter.trackId]?.color}
      />
    {:else}
      <g><text> {parameterId} Parameter not found</text></g>
    {/if}
  {/await}
{/if}

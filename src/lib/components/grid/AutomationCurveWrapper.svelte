<script lang="ts">
  import type { TrackCustomization } from '$lib/stores/customization.svelte';
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
  import AutomationCurve from './AutomationCurve.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    height: number;
    width: number;
    yPosition: number;
    trackCustomizations: Record<string, TrackCustomization>;
  }

  let { parameterId, height, width, yPosition, trackCustomizations }: AutomationCurveProps =
    $props();
  let parameterStore = useTrackDbQuery((db) => db.tracks.getParameterById(parameterId), null);
  let parameter = $derived(parameterStore.getResult());
  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));

  let automationPointsStore = useTrackDbQuery(
    (db) => db.automation.getAutomationPoints({ parameterId }),
    [],
  );
  let automationPoints = $derived(automationPointsStore.getResult());
</script>

{#if isExpanded}
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
{/if}

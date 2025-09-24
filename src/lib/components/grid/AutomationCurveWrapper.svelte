<script lang="ts">
  import type { AutomationPoint } from '$lib/database/schema';
  import type { TrackCustomization } from '$lib/stores/customization.svelte';
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
  import AutomationCurve from './AutomationCurve.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

  interface AutomationCurveWrapperProps {
    parameterId: string;
    height: number;
    width: number;
    yPosition: number;
    trackCustomizations: Record<string, TrackCustomization>;
    automationPoints: AutomationPoint[];
  }

  let {
    parameterId,
    height,
    width,
    yPosition,
    trackCustomizations,
    automationPoints,
  }: AutomationCurveWrapperProps = $props();

  let parameterStore = useTrackDbQuery((db) => db.tracks.getParameterById(parameterId), null);
  let parameter = $derived(parameterStore.getResult());
  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));
</script>

{#if parameter}
  {#if isExpanded}
    <AutomationCurve
      {parameterId}
      {parameter}
      {height}
      {width}
      {yPosition}
      {automationPoints}
      color={trackCustomizations[parameter.trackId]?.color}
    />
  {/if}
{:else}
  <g><text> {parameterId} Parameter not found</text></g>
{/if}

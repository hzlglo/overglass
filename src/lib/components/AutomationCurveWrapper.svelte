<script lang="ts">
  import { automationDb } from '../stores/database.svelte';
  import AutomationCurve from './AutomationCurve.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    height: number;
    width: number;
    yPosition: number;
  }

  let { parameterId, height, width, yPosition }: AutomationCurveProps = $props();
  let parameterPromise = $derived(automationDb.get().tracks.getParameterById(parameterId));
</script>

{#await parameterPromise then parameter}
  {#if parameter}
    <AutomationCurve {parameterId} {parameter} {height} {width} {yPosition} />
  {:else}
    <g><text> {parameterId} Parameter not found</text></g>
  {/if}
{/await}

<script lang="ts">
  import { automationDb } from '../stores/database.svelte';
  import AutomationCurve from './AutomationCurve.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    height: number;
    width: number;
  }

  let { parameterId, height, width }: AutomationCurveProps = $props();
  let parameterPromise = $derived(automationDb.get().tracks.getParameterById(parameterId));
</script>

{#await parameterPromise then parameter}
  {#if parameter}
    <AutomationCurve
      {parameterId}
      minValue={parameter.minValue}
      maxValue={parameter.maxValue}
      {height}
      {width}
    />
  {:else}
    <div class="text-error">Parameter not found</div>
  {/if}
{/await}

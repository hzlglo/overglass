<script lang="ts">
  import { automationDb } from '$lib/stores/database.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import LaneControl from './LaneControl.svelte';

  interface AutomationParameterProps {
    parameterId: string;
  }

  let { parameterId }: AutomationParameterProps = $props();

  let parameterPromise = $derived(automationDb.get().tracks.getParameterById(parameterId));

  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));
</script>

{#await parameterPromise then parameter}
  {#if parameter}
    <LaneControl
      title={parameter.parameterName}
      {isExpanded}
      onToggleExpanded={() => gridDisplayState.toggleParameterExpansion(parameterId)}
      laneId={parameterId}
    ></LaneControl>
  {:else}
    <div class="text-error">Parameter not found</div>
  {/if}
{/await}

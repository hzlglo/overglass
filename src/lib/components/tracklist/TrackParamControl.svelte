<script lang="ts">
  import { automationDb } from '$lib/stores/database.svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
  import LaneControl from './LaneControl.svelte';
  import { appConfigStore, type TrackCustomization } from '$lib/stores/customization.svelte';
  import { ElektronNameMatcher } from '$lib/config/regex';

  interface AutomationParameterProps {
    parameterId: string;
  }

  let { parameterId }: AutomationParameterProps = $props();

  let parameterPromise = $derived(automationDb.get().tracks.getParameterById(parameterId));

  let isExpanded = $derived(gridDisplayState.getParameterExpanded(parameterId));
  let getParameterDisplayName = (parameterName: string, trackConfig: TrackCustomization | null) => {
    if (!trackConfig || !trackConfig.userEnteredName) {
      return parameterName;
    }
    return `${trackConfig.userEnteredName} ${ElektronNameMatcher.cleanParameterName(parameterName)}`;
  };
</script>

{#await parameterPromise then parameter}
  {#if parameter}
    {#await appConfigStore.getTrackCustomization(parameter.trackId) then trackConfig}
      <LaneControl
        title={getParameterDisplayName(parameter.parameterName, trackConfig)}
        {isExpanded}
        onToggleExpanded={() => gridDisplayState.toggleParameterExpansion(parameterId)}
        laneId={parameterId}
      ></LaneControl>
    {/await}
  {:else}
    <div class="text-error">Parameter not found</div>
  {/if}
{/await}

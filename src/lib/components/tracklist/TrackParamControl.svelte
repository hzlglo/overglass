<script lang="ts">
  import { ElektronNameMatcher } from '$lib/config/regex';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { Maximize2Icon, Minimize2Icon } from '@lucide/svelte';
  import { sharedGridState } from '../grid/sharedGridState.svelte';
  import LaneControl from './LaneControl.svelte';

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
      <div class="flex flex-row justify-end gap-2">
        <button
          class="btn btn-xs btn-ghost hidden group-hover:block"
          onclick={() => {
            const height = sharedGridState.getLaneHeight(parameterId);
            sharedGridState.setLaneHeight(parameterId, height * 1.5);
          }}
        >
          <Maximize2Icon class="size-3" />
        </button>
        <button
          class="btn btn-xs btn-ghost hidden group-hover:block"
          onclick={() => {
            const height = sharedGridState.getLaneHeight(parameterId);
            sharedGridState.setLaneHeight(parameterId, height / 1.5);
          }}
        >
          <Minimize2Icon class="size-3" />
        </button>
      </div>
    {/snippet}
  </LaneControl>
{:else}
  {$inspect('TrackParamControl - parameter not found', parameterId, parameterState)}
  <div class="text-error">Parameter not found</div>
{/if}

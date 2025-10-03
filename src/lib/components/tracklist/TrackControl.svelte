<script lang="ts">
  import TrackParamControl from './TrackParamControl.svelte';
  import { sharedGridState } from '../grid/sharedGridState.svelte';
  import LaneControl from './LaneControl.svelte';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import ColorChooser from '../colors/ColorChooser.svelte';
  import { getThemeColor } from '$lib/utils/utils';
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { uniq } from 'lodash';
  import { flip } from 'svelte/animate';

  interface TrackProps {
    trackId: string;
  }

  let { trackId }: TrackProps = $props();

  let trackState = $derived(sharedGridState.getTrackState(trackId));

  let parameters: { id: string }[] = $state([]);
  $effect(() => {
    parameters =
      sharedGridState
        .getParameterOrder()
        .get(trackId)
        ?.map((p) => ({
          id: p,
        })) ?? [];
  });
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[trackId] ?? null);
</script>

{#if trackState}
  <LaneControl
    title={trackConfig?.userEnteredName || trackState.track.trackName}
    subtitle={trackConfig?.userEnteredName ? trackState.track.trackName : undefined}
    onRename={(newTitle) => appConfigStore.setTrackName(trackState.track.id, newTitle)}
    class="font-bold"
    isExpanded={trackState.expanded}
    onToggleExpanded={() => sharedGridState.toggleTrackExpansion(trackId)}
    laneId={trackId}
    color={trackConfig?.color}
  >
    {#snippet inlineActions()}
      <ColorChooser
        value={trackConfig?.color || getThemeColor('primary')}
        onValueChange={(color) => appConfigStore.setTrackColor(trackId, color)}
      />
    {/snippet}
    <div
      class="flex flex-col"
      use:dndzone={{
        items: parameters,
        flipDurationMs: 150,
        dropFromOthersDisabled: true,
      }}
      onconsider={(e) => {
        parameters = e.detail.items;
      }}
      onfinalize={(e) => {
        sharedGridState.setParameterOrder(trackId, uniq(e.detail.items.map((t) => t.id)));
      }}
    >
      {#each parameters as parameter (parameter.id)}
        <div
          animate:flip={{ duration: 150 }}
          data-is-dnd-shadow-item-hint={parameter[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
        >
          <TrackParamControl parameterId={parameter.id}></TrackParamControl>
        </div>
      {/each}
    </div>
  </LaneControl>
{/if}

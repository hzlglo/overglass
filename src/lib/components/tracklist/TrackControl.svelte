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
  import { PlusIcon } from '@lucide/svelte';
  import { appModalState } from '../app/appModals/appModalState.svelte';

  interface TrackProps {
    trackId: string;
  }

  let { trackId }: TrackProps = $props();

  let trackState = $derived(sharedGridState.getTrackState(trackId));

  let parameters: { id: string }[] = $state([]);
  $effect(() => {
    parameters =
      sharedGridState.getParameterOrder()[trackId]?.map((p) => ({
        id: p,
      })) ?? [];
  });
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[trackId] ?? null);
  let subtitle = $derived(trackConfig?.userEnteredName ? trackState.track.trackName : undefined);
</script>

{#if trackState}
  <LaneControl
    title={trackConfig?.userEnteredName || trackState.track.trackName}
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
    {#snippet actions()}
      <div class="ml-7 flex flex-row gap-2">
        {#if subtitle}
          <div class="text-base-content/60 text-sm">
            {subtitle}
          </div>
        {/if}
        <button
          class="btn btn-xs btn-square btn-ghost hidden justify-items-center group-hover:block"
          onclick={() => {
            appModalState.setModal({
              type: 'newLane',
              props: {
                initialName: `${trackState.device.deviceName} T${trackState.track.trackNumber}`,
              },
            });
          }}
        >
          <PlusIcon class="size-3" />
        </button>
      </div>
    {/snippet}
    <div
      class="flex flex-col"
      use:dndzone={{
        items: parameters,
        flipDurationMs: 150,
        dropFromOthersDisabled: true,
        dropTargetStyle: { outline: 'var(--color-accent) solid 2px' },
      }}
      onconsider={(e) => {
        if (e.detail.items.length !== parameters.length) {
          console.log(
            'Preventing drag reorder because length mismatch',
            e.detail.items,
            parameters,
          );
          return;
        }
        parameters = e.detail.items;
      }}
      onfinalize={(e) => {
        if (e.detail.items.length !== parameters.length) {
          console.log(
            'Preventing drag reorder because length mismatch',
            e.detail.items,
            parameters,
          );
          return;
        }
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

<script lang="ts">
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
  import TrackParamControl from './TrackParamControl.svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
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

  let trackStore = useTrackDbQuery((trackDb) => trackDb.tracks.getTrackById(trackId), 'abc');
  let track = $derived(trackStore.getResult());

  $inspect('TrackControl', trackId, track, trackStore);

  let isTrackExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));

  let deviceStore = useTrackDbQuery((trackDb) => trackDb.devices.getTrackDevice(trackId), null);
  let device = $derived(deviceStore.getResult());
  let parameters: { id: string }[] = $state([]);
  $effect(() => {
    console.log('TrackControl: parameters');
    parameters =
      gridDisplayState
        .getParameterOrder()
        .get(trackId)
        ?.map((p) => ({
          id: p,
        })) ?? [];
  });
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[trackId] ?? null);
</script>

{#if track}
  <LaneControl
    title={trackConfig?.userEnteredName || track.trackName}
    onRename={(newTitle) => appConfigStore.setTrackName(track.id, newTitle)}
    class="font-bold"
    isExpanded={isTrackExpanded}
    onToggleExpanded={() => gridDisplayState.toggleTrackExpansion(trackId)}
    laneId={trackId}
    color={trackConfig?.color}
  >
    {#snippet actions()}
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
        gridDisplayState.setParameterOrder(trackId, uniq(e.detail.items.map((t) => t.id)));
      }}
    >
      {#each parameters as parameter (parameter.id)}
        <div
          animate:flip={{ duration: 150 }}
          data-is-dnd-shadow-item-hint={parameter[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
        >
          <TrackParamControl parameterId={parameter.id} {trackConfig}></TrackParamControl>
        </div>
      {/each}
    </div>
  </LaneControl>
{:else}
  <div class="text-error">Track {trackId} not found</div>
{/if}

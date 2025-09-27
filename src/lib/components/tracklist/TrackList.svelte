<script lang="ts">
  import TrackControl from './TrackControl.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    gridDisplayState,
    TOP_TIMELINE_HEIGHT,
  } from '../grid/gridDisplayState.svelte';
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import SizeObserver from '../core/SizeObserver.svelte';
  import { flip } from 'svelte/animate';
  import { uniq } from 'lodash';

  let tracks: { id: string; name: string }[] = $state([]);
  $effect(() => {
    tracks = gridDisplayState.getTrackOrder().map((id) => ({ id, name: id }));
  });

  let trackListContainer = $state<HTMLDivElement>();
  $effect(() => {
    if (!trackListContainer) return;
    gridDisplayState.setTrackListContainer(trackListContainer);
  });
  $effect(() => {
    let gridContainer = gridDisplayState.getGridContainer();
    if (!trackListContainer || !gridContainer) return;
    const syncScroll = () => {
      if (!trackListContainer || !gridContainer) return;
      gridDisplayState.syncScroll(trackListContainer, gridContainer);
    };
    trackListContainer.addEventListener('scroll', syncScroll);
    return () => {
      trackListContainer?.removeEventListener('scroll', syncScroll);
    };
  });
  let height = $state(0);
  let width = $state(0);
</script>

<div class="flex min-h-0 flex-col">
  <div style="height: {TOP_TIMELINE_HEIGHT}px"></div>
  <SizeObserver bind:height bind:width>
    <div class="flex-1">
      <div
        class="overflow-y-scroll"
        style="height: {height}px"
        bind:this={trackListContainer}
        use:dndzone={{
          items: tracks,
          flipDurationMs: 150,
          dropFromOthersDisabled: true,
          // centreDraggedOnCursor: true,
        }}
        onconsider={(e) => {
          console.log('TrackList: consider', e.detail.items, e);
          tracks = e.detail.items;
        }}
        onfinalize={(e) => {
          console.log('TrackList: finalize', e.detail.items, e);
          gridDisplayState.setTrackOrder(uniq(e.detail.items.map((t) => t.id)));
        }}
      >
        {#each tracks as track (track.id)}
          <div
            class="min-h-0"
            data-is-dnd-shadow-item-hint={track[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
            animate:flip={{ duration: 150 }}
          >
            <TrackControl trackId={track.id} />
          </div>
        {/each}
      </div>
    </div>
  </SizeObserver>
  <div style="height: {BOTTOM_TIMELINE_HEIGHT}px"></div>
</div>

<script lang="ts">
  import TrackControl from './TrackControl.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    gridDisplayState,
    TOP_TIMELINE_HEIGHT,
  } from './gridDisplayState.svelte';

  let trackIds = $derived(gridDisplayState.getTrackOrder());

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
</script>

<div class="flex min-h-0 flex-col">
  <div style="height: {TOP_TIMELINE_HEIGHT}px"></div>
  <div class="flex-1 overflow-y-auto" bind:this={trackListContainer}>
    {#each trackIds as trackId}
      <TrackControl {trackId} />
    {/each}
  </div>
  <div style="height: {BOTTOM_TIMELINE_HEIGHT}px"></div>
</div>

<script lang="ts">
  import GridTimelineTop from './GridTimelineTop.svelte';
  import GridTimelineBottom from './GridTimelineBottom.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import { automationDb } from '$lib/stores/database.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    gridDisplayState,
    TOP_TIMELINE_HEIGHT,
  } from './gridDisplayState.svelte';
  import SizeObserver from './SizeObserver.svelte';
  import AutomationCurveWrapper from './AutomationCurveWrapper.svelte';

  $effect(() => {
    console.log('innerWidth', innerWidth);
    sharedXScale.setWidth(innerWidth);
  });

  $effect(async () => {
    let setMaxTime = sharedXScale.setMaxTime;
    const maxTime = await automationDb.get().automation.getMaxTime();
    setMaxTime(maxTime);
  });
  let width = $state(0);
  let height = $state(0);
  let gridContainer = $state<HTMLDivElement>();
  $effect(() => {
    if (!gridContainer) return;
    gridDisplayState.setGridContainer(gridContainer);
  });

  $effect(() => {
    let trackListContainer = gridDisplayState.getTrackListContainer();
    if (!trackListContainer || !gridContainer) return;
    const syncScroll = () => {
      if (!trackListContainer || !gridContainer) return;
      gridDisplayState.syncScroll(gridContainer, trackListContainer);
    };
    gridContainer.addEventListener('scroll', syncScroll);
    return () => {
      gridContainer?.removeEventListener('scroll', syncScroll);
    };
  });
</script>

<SizeObserver bind:width bind:height>
  <div class="flex min-h-0 flex-col">
    <GridTimelineTop height={TOP_TIMELINE_HEIGHT} {width} />
    <div class="no-scrollbar flex flex-1 flex-col overflow-y-auto" bind:this={gridContainer}>
      {#each gridDisplayState.getTrackOrder() as trackId}
        <svg class="shrink-0" height={gridDisplayState.getLaneHeight(trackId)}>
          <g>
            <text x="10" y="20" fill="currentColor">device placeholder</text>
          </g>
        </svg>
        {#each gridDisplayState.getParameterOrder(trackId) as parameterId}
          <AutomationCurveWrapper
            {parameterId}
            height={gridDisplayState.getLaneHeight(parameterId)}
            {width}
          />
        {/each}
      {/each}
    </div>
    <GridTimelineBottom height={BOTTOM_TIMELINE_HEIGHT} {width} />
  </div>
</SizeObserver>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
</style>

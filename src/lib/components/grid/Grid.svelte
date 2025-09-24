<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import * as d3 from 'd3';
  import { groupBy, isEqual } from 'lodash';
  import SizeObserver from '../core/SizeObserver.svelte';
  import AutomationCurveWrapper from './AutomationCurveWrapper.svelte';
  import GridBrush from './GridBrush.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    gridDisplayState,
    TOP_TIMELINE_HEIGHT,
  } from './gridDisplayState.svelte';
  import GridTimelineBottom from './GridTimelineBottom.svelte';
  import GridTimelineTop from './GridTimelineTop.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import MuteClipsWrapper from './MuteClipsWrapper.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import GridContextMenu from './GridContextMenu.svelte';
  import { actionsDispatcher } from './actionsDispatcher.svelte';

  let maxTimeStore = useTrackDbQuery((trackDb) => trackDb.automation.getMaxTime(), 0);
  let maxTime = $derived(maxTimeStore.getResult());
  $effect(() => {
    let setMaxTime = sharedXScale.setMaxTime;
    let sharedMaxTime = sharedXScale.getMaxTime();
    if (maxTime && isEqual(maxTime, sharedMaxTime)) {
      return;
    }
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
    sharedXScale.setWidth(width);
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

  let trackCustomizations = $derived(appConfigStore.get()?.trackCustomizations ?? {});
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let gridHeight = $derived(gridDisplayState.getGridHeight());
  let gridWidth = $derived(width);
  let innerHeight = $derived(gridHeight - margin.top - margin.bottom);

  let lanes = $derived(gridDisplayState.getLanes());

  // Setup SVG structure with zoom
  let svgElement = $state<SVGElement>();
  let svg = $derived(svgElement ? d3.select(svgElement) : undefined);
  let svgGroupElement = $state<SVGGElement>();
  let svgGroup = $derived(svgGroupElement ? d3.select(svgGroupElement) : undefined);

  $effect(() => {
    let zoom = sharedXScale.getZoom();
    if (!svg) {
      return;
    }

    const pan = (event: WheelEvent) => {
      zoom.translateBy(svg.transition().duration(50), event.wheelDeltaX, 0);
      if (Math.abs(event.wheelDeltaX) > Math.abs(event.wheelDeltaY)) {
        event.preventDefault();
      }
    };
    svg.call(zoom).on('wheel', pan);
  });

  let brush = $state<d3.BrushBehavior<unknown>>();
  $effect(() => {
    if (!svg) return;
    svg.on('keydown', (event) => {
      console.log('svg keydown', event);

      // Mac: event.metaKey, Windows/Linux: event.ctrlKey
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); // stops browser select-all
        d3.select('.brush-group').call(brush?.move, [
          [0, 0],
          [
            innerWidth,
            // subtract 1 to ensure we don't outside grid boundary
            innerHeight - 1,
          ],
        ]);
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        actionsDispatcher.handleKeyDown('delete');
      }
    });
  });

  let xAxisBars = $derived(sharedXScale.getXAxisBars());

  // Draw grid lines
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      // Remove existing grid
      svgGroup.selectAll('.x-grid').remove();

      // X-axis grid
      svgGroup
        .append('g')
        .attr('class', 'x-grid')
        .call(xAxisBars.tickSize(-innerHeight).tickFormat(() => ''))
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

      // Y-axis grid
      svgGroup.selectAll('.y-grid').remove();
      if (lanes.length > 0) {
        svgGroup
          .append('g')
          .attr('class', 'y-grid')
          .selectAll('line')
          .data(lanes.map((l) => l.bottom))
          .enter()
          .append('line')
          .attr('class', 'y-grid')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', (d) => d)
          .attr('y2', (d) => d)
          .attr('stroke', 'currentColor')
          .style('opacity', 0.5);
      }
    }
  });

  let automationPointsStore = useTrackDbQuery((db) => db.automation.getAutomationPoints({}), []);
  let automationPoints = $derived(automationPointsStore.getResult());
  let automationPointsByParameterId = $derived(groupBy(automationPoints, (p) => p.parameterId));

  let muteTransitionsStore = useTrackDbQuery((db) => db.muteTransitions.getAll(), []);
  let muteTransitions = $derived(muteTransitionsStore.getResult());
  let muteTransitionsByTrackId = $derived(groupBy(muteTransitions, (t) => t.trackId));
  $effect(() => {
    sharedDragSelect.setAllMuteTransitionsByTrackId(muteTransitionsByTrackId);
  });
</script>

<SizeObserver bind:width bind:height>
  <div class="flex min-h-0 flex-col" style={`width: ${gridWidth}px`}>
    <GridTimelineTop height={TOP_TIMELINE_HEIGHT} width={gridWidth} />
    <div class="no-scrollbar flex flex-1 flex-col overflow-y-auto" bind:this={gridContainer}>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <svg
        class="shrink-0 focus:outline-none"
        height={gridHeight}
        width={gridWidth}
        bind:this={svgElement}
        tabindex="0"
      >
        <GridBrush {muteTransitionsByTrackId} {automationPointsByParameterId} bind:brush />
        <g bind:this={svgGroupElement}>
          {#each lanes as lane (lane.id)}
            {#if lane.type === 'track'}
              <MuteClipsWrapper
                trackId={lane.id}
                height={gridDisplayState.getLaneHeight(lane.id)}
                width={gridWidth}
                yPosition={lane.top}
                {trackCustomizations}
                muteTransitions={muteTransitionsByTrackId[lane.id]}
              />
            {:else if lane.type === 'parameter'}
              <AutomationCurveWrapper
                parameterId={lane.id}
                height={gridDisplayState.getLaneHeight(lane.id)}
                width={gridWidth}
                yPosition={lane.top}
                {trackCustomizations}
                automationPoints={automationPointsByParameterId[lane.id]}
              />
            {/if}
          {/each}
        </g>
      </svg>
    </div>
    <GridTimelineBottom height={BOTTOM_TIMELINE_HEIGHT} width={gridWidth} />
  </div>
</SizeObserver>

<GridContextMenu />

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

<script lang="ts">
  import { useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import * as d3 from 'd3';
  import { clamp, groupBy, isEqual, min } from 'lodash';
  import SizeObserver from '../core/SizeObserver.svelte';
  import AutomationCurveWrapper from './AutomationCurveWrapper.svelte';
  import GridBrush from './GridBrush.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    sharedGridState,
    TOP_TIMELINE_HEIGHT,
  } from './sharedGridState.svelte';
  import GridTimelineBottom from './GridTimelineBottom.svelte';
  import GridTimelineTop from './GridTimelineTop.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import MuteClipsWrapper from './MuteClipsWrapper.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import GridContextMenu from './GridContextMenu.svelte';
  import { actionsDispatcher } from './actionsDispatcher.svelte';
  import PlayLine from './PlayLine.svelte';
  import VirtualizedLane from './VirtualizedLane.svelte';

  let { gridScroll = $bindable() }: { gridScroll: number } = $props();

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
  $effect(() => {
    sharedXScale.setWidth(width);
  });

  // the full height of all tracks
  let innerGridHeight = $derived(sharedGridState.getGridHeight());
  let clippedGridHeight = $derived(
    min([height - TOP_TIMELINE_HEIGHT - BOTTOM_TIMELINE_HEIGHT, innerGridHeight])!,
  );

  let lanes = $derived(sharedGridState.getLanes());

  // Setup SVG structure with zoom
  let svgElement = $state<SVGElement>();
  let svg = $derived(svgElement ? d3.select(svgElement) : undefined);

  const scroll = $derived((dy: number) => {
    gridScroll = clamp(gridScroll + dy, 0, innerGridHeight - clippedGridHeight);
  });

  $effect(() => {
    if (!svg) {
      return;
    }
    let zoom = sharedXScale.getZoom();

    const pan = (event: WheelEvent) => {
      console.log('pan', event.deltaX, sharedXScale.getDataDeltaForScreenDelta(event.deltaX));
      const currentZoomTransform = sharedXScale.getCurrentZoomTransform();

      // Adjust scroll speed inversely proportional to zoom
      const scaleFactor = currentZoomTransform ? 1 / currentZoomTransform.k : 1; // smaller movement when zoomed in

      zoom.translateBy(
        svg, //.transition().duration(5),
        // -event.deltaX,
        -event.deltaX * scaleFactor,
        0,
      );
      scroll(event.deltaY);
      event.preventDefault();
    };
    svg.call(zoom).on('wheel', pan);
  });

  $effect(() => {
    // trackGroup?.on('click', (event) => {
    //   if (playState.getIsPlaying()) return;
    //   playState.setPlayPoint(sharedXScale.getZoomedXScale().invert(event.offsetX));
    // });
  });

  let xAxisBars = $derived(sharedXScale.getXAxisBars());

  // Draw grid lines
  let ticksGroupElement = $state<SVGGElement>();
  let ticksGroup = $derived(ticksGroupElement ? d3.select(ticksGroupElement) : undefined);
  $effect(() => {
    if (ticksGroup && width > 0 && innerGridHeight > 0) {
      // Remove existing grid
      ticksGroup.selectAll('.x-grid').remove();

      // X-axis grid
      ticksGroup
        .append('g')
        .attr('class', 'x-grid')
        .call(xAxisBars.tickSize(-innerGridHeight).tickFormat(() => ''))
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

      // Y-axis grid
      ticksGroup.selectAll('.y-grid').remove();
      if (lanes.length > 0) {
        ticksGroup
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
    $effect(() => {
      if (!ticksGroup) return;
      ticksGroup
        .selectAll('.loop-marker')
        .data(sharedXScale.getLoopTicks())
        .join(
          (enter) => enter.append('line'),
          (update) => update,
          (exit) => exit.remove(),
        )
        .attr('class', 'loop-marker')
        .attr('x1', (d) => sharedXScale.getZoomedXScaleBars()(d))
        .attr('x2', (d) => sharedXScale.getZoomedXScaleBars()(d))
        .attr('y1', 0)
        .attr('y2', innerGridHeight)
        .attr('stroke', 'currentColor')
        .style('opacity', 0.3);
    });
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

  $effect(() => {
    if (!svg) return;
    svg.on('keydown', (event) => {
      // Mac: event.metaKey, Windows/Linux: event.ctrlKey
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); // stops browser select-all
        sharedDragSelect.setSelectedPoints(automationPoints);
        sharedDragSelect.setSelectedMuteTransitions(muteTransitions);
        sharedDragSelect.setSelectedLanes(lanes);
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        actionsDispatcher.handleKeyDown('delete');
      }
    });
  });
</script>

<SizeObserver bind:width bind:height>
  <div class="flex min-h-0 flex-col" style={`width: ${width}px`}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <svg class="shrink-0 focus:outline-none" {height} {width} bind:this={svgElement} tabindex="0">
      <GridTimelineTop height={TOP_TIMELINE_HEIGHT} {width} />
      <g transform={`translate(0,${TOP_TIMELINE_HEIGHT})`}>
        <clipPath id="grid-clip">
          <rect x={0} y={0} {width} height={clippedGridHeight} />
        </clipPath>
        <g clip-path="url(#grid-clip)">
          <g transform={`translate(0,${-gridScroll})`}>
            <g bind:this={ticksGroupElement}></g>

            <GridBrush
              {muteTransitionsByTrackId}
              {automationPointsByParameterId}
              height={innerGridHeight}
              {width}
            />
            <g>
              {#each lanes as lane (lane.id)}
                <VirtualizedLane
                  height={sharedGridState.getLaneHeight(lane.id)}
                  {width}
                  yPosition={lane.top}
                  {gridScroll}
                  gridHeight={height}
                >
                  {#if lane.type === 'track'}
                    <MuteClipsWrapper
                      {lane}
                      {width}
                      muteTransitions={muteTransitionsByTrackId[lane.id] ?? []}
                    />
                  {:else if lane.type === 'parameter'}
                    <AutomationCurveWrapper
                      {lane}
                      {width}
                      automationPoints={automationPointsByParameterId[lane.id] ?? []}
                    />
                  {/if}
                </VirtualizedLane>
              {/each}
            </g>
          </g>
        </g>
      </g>
      <GridTimelineBottom
        y={clippedGridHeight + TOP_TIMELINE_HEIGHT}
        height={BOTTOM_TIMELINE_HEIGHT}
        {width}
      />
      <PlayLine height={clippedGridHeight + TOP_TIMELINE_HEIGHT + BOTTOM_TIMELINE_HEIGHT} />
    </svg>
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

<script lang="ts">
  import { automationDb } from '$lib/stores/database.svelte';
  import * as d3 from 'd3';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    gridDisplayState,
    TOP_TIMELINE_HEIGHT,
  } from './gridDisplayState.svelte';
  import GridTimelineBottom from './GridTimelineBottom.svelte';
  import GridTimelineTop from './GridTimelineTop.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import SizeObserver from '../core/SizeObserver.svelte';
  import AutomationCurveWrapper from './AutomationCurveWrapper.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import type { AutomationPoint } from '$lib/database/schema';
  import { flatten, groupBy } from 'lodash';
  import { SvelteSet } from 'svelte/reactivity';
  import { appConfigStore } from '$lib/stores/customization.svelte';

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

  let trackOrder = $derived(gridDisplayState.getTrackOrder());
  let parameterOrder = $derived(gridDisplayState.getParameterOrder());
  let lanes = $derived(gridDisplayState.getLanes());

  // Setup SVG structure with zoom
  let svgElement = $state<SVGElement>();
  let svg = $derived(svgElement ? d3.select(svgElement) : undefined);
  let svgGroupElement = $state<SVGGElement>();
  let svgGroup = $derived(svgGroupElement ? d3.select(svgGroupElement) : undefined);

  // $effect(() => {
  //   if (!svg) {
  //     return;
  //   }
  //   svg.selectAll('*').remove();
  //   // Create clipping path definition
  //   const defs = svg.append('defs');
  //   defs
  //     .append('clipPath')
  //     .attr('id', `clip-grid`)
  //     .append('rect')
  //     .attr('x', 0)
  //     .attr('y', 0)
  //     .attr('width', innerWidth)
  //     .attr('height', innerHeight);

  //   svgGroup = svg
  //     .append('g')
  //     .attr('transform', `translate(${margin.left},${margin.top})`)
  //     .attr('clip-path', `url(#clip-grid)`);
  // });

  // Load automation points
  let automationPointsByParameterId = $state<Record<string, AutomationPoint[]>>({});
  $effect(async () => {
    const points = await automationDb.get().automation.getAutomationPoints({});
    automationPointsByParameterId = groupBy(points, (point) => point.parameterId);
  });

  $inspect('automationPointsByParameterId', automationPointsByParameterId);

  $effect(() => {
    let zoom = sharedXScale.getZoom();
    if (!svg) {
      return;
    }

    const pan = (event: WheelEvent) => {
      zoom.translateBy(svg.transition().duration(50), event.wheelDeltaX, 0);
    };
    svg.call(zoom).on('wheel', pan);
  });

  let brushGElement = $state<SVGGElement>();
  let brushG = $derived(brushGElement ? d3.select(brushGElement) : undefined);
  let brushHandler = (event) => {
    if (!event.selection) {
      sharedDragSelect.setBrushSelection(null);
      sharedDragSelect.setSelectedLanes([]);
      sharedDragSelect.getSelectedPoints().clear();
      return;
    }
    let [[x0, y0], [x1, y1]] = event.selection;
    let { sourceEvent } = event;
    if (sourceEvent && brushG) {
      // Snap y0 and y1 to allowed values
      const firstLaneIndex = lanes.findIndex((l) => l.top <= y0);
      const lastLaneIndex = lanes.findIndex((l) => l.bottom >= y1);
      y0 = lanes[firstLaneIndex].top;
      y1 = lanes[lastLaneIndex].bottom;

      // Ensure y0 < y1
      if (y0 > y1) [y0, y1] = [y1, y0];

      // Update the brush rectangle visually
      brushG.call(brush.move, [
        [x0, y0],
        [x1, y1],
      ]);
      let selectedLanes = lanes.slice(firstLaneIndex, lastLaneIndex + 1);
      sharedDragSelect.setSelectedLanes(selectedLanes);

      const xScale = sharedXScale.getZoomedXScale();
      let [startTime, endTime] = [xScale.invert(x0), xScale.invert(x1)];
      let selectedPoints = flatten(
        selectedLanes
          .filter((l) => l.type === 'parameter')
          .map((l) =>
            automationPointsByParameterId[l.id].filter(
              (p) => p.timePosition >= startTime && p.timePosition <= endTime,
            ),
          ),
      );
      sharedDragSelect.setSelectedPoints(new SvelteSet(selectedPoints));
    }

    sharedDragSelect.setBrushSelection({ x0, y0, x1, y1 });
  };
  const brush = $derived(
    d3
      .brush()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .filter((event) => {
        // Only allow brushing for left-clicks **without dragging a point**
        return !event.target.classList.contains('draggable') && event.button === 0;
      })
      .on('start brush end', brushHandler),
  );
  $effect(() => {
    if (!brushG) {
      return;
    }
    brushG.call(brush);
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
</script>

<SizeObserver bind:width bind:height>
  <div class="flex min-h-0 flex-col" style={`width: ${gridWidth}px`}>
    <GridTimelineTop height={TOP_TIMELINE_HEIGHT} width={gridWidth} />
    <div class="no-scrollbar flex flex-1 flex-col overflow-y-auto" bind:this={gridContainer}>
      <svg class="shrink-0" height={gridHeight} width={gridWidth} bind:this={svgElement}>
        <g bind:this={brushGElement} class="brush-group"></g>
        <g bind:this={svgGroupElement}>
          {#each lanes as lane (lane.id)}
            {#if lane.type === 'parameter'}
              <AutomationCurveWrapper
                parameterId={lane.id}
                height={gridDisplayState.getLaneHeight(lane.id)}
                width={gridWidth}
                yPosition={lane.top}
                automationPoints={automationPointsByParameterId[lane.id]}
                {trackCustomizations}
              />
            {/if}
          {/each}
        </g>
      </svg>
    </div>
    <GridTimelineBottom height={BOTTOM_TIMELINE_HEIGHT} width={gridWidth} />
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

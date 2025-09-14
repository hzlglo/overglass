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
  import SizeObserver from './SizeObserver.svelte';
  import AutomationCurveWrapper from './AutomationCurveWrapper.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { binarySearchCeiling, binarySearchFloor } from '$lib/utils/utils';
  import { last } from 'lodash';

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

  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let gridHeight = $derived(gridDisplayState.getGridHeight());
  let gridWidth = $derived(width);
  let innerHeight = $derived(gridHeight - margin.top - margin.bottom);

  let trackOrder = $derived(gridDisplayState.getTrackOrder());
  let parameterOrder = $derived(gridDisplayState.getParameterOrder());
  let laneYPositions = $derived(gridDisplayState.getLaneYPositions());
  let laneBoundaries = $derived(gridDisplayState.getLaneBoundaries());

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

  let brushG = $derived.by(() => {
    if (!svg) {
      return;
    }
    svg.selectAll('.brush').remove();
    return svg.append('g').attr('class', 'brush');
  });
  let brushHandler = (event) => {
    if (!event.selection) {
      sharedDragSelect.setBrushSelection(null);
      return;
    }
    let [[x0, y0], [x1, y1]] = event.selection;
    let { sourceEvent } = event;
    if (sourceEvent && brushG) {
      // Snap y0 and y1 to allowed values
      y0 = binarySearchFloor(laneBoundaries, y0);
      y1 = binarySearchCeiling(laneBoundaries, y1);

      // Ensure y0 < y1
      if (y0 > y1) [y0, y1] = [y1, y0];

      // Update the brush rectangle visually
      brushG.call(brush.move, [
        [x0, y0],
        [x1, y1],
      ]);
    }

    sharedDragSelect.setBrushSelection({ x0, y0, x1, y1 });
  };
  const brush = $derived(
    d3
      .brush()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ]) // SVG bounds
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
      if (laneBoundaries.length > 0) {
        svgGroup
          .append('g')
          .attr('class', 'y-grid')
          .selectAll('line')
          .data(laneBoundaries)
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
        <g bind:this={svgGroupElement}>
          {#each trackOrder as trackId (trackId)}
            {#each parameterOrder[trackId] as parameterId (parameterId)}
              <AutomationCurveWrapper
                {parameterId}
                height={gridDisplayState.getLaneHeight(parameterId)}
                width={gridWidth}
                yPosition={laneYPositions[parameterId]}
              />
            {/each}
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

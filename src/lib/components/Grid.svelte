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

  let gridHeight = $derived(gridDisplayState.getGridHeight());

  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let innerHeight = $derived(gridHeight - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());
  let trackOrder = $derived(gridDisplayState.getTrackOrder());
  let parameterOrder = $derived(gridDisplayState.getParameterOrder());
  let laneYPositions = $derived(gridDisplayState.getLaneYPositions());
  $inspect('laneYPositions', laneYPositions);

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
    if (!svgGroup) {
      return;
    }
    svgGroup.call(zoom);
  });

  let xAxisBars = $derived(sharedXScale.getXAxisBars());

  // Draw grid lines
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      // Remove existing grid
      svgGroup.selectAll('.grid').remove();

      // X-axis grid
      svgGroup
        .append('g')
        .attr('class', 'grid')
        .call(xAxisBars.tickSize(-innerHeight).tickFormat(() => ''))
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

      // Y-axis grid
      // svgGroup
      //   .append('g')
      //   .attr('class', 'grid')
      //   .call(
      //     d3
      //       .axisLeft(yScale)
      //       .tickSize(-innerWidth)
      //       .tickFormat(() => ''),
      //   )
      //   .style('stroke-dasharray', '3,3')
      //   .style('opacity', 0.3);
    }
  });
  $inspect('parameterOrder', parameterOrder);
</script>

<SizeObserver bind:width bind:height>
  <div class="flex min-h-0 flex-col">
    <GridTimelineTop height={TOP_TIMELINE_HEIGHT} {width} />
    <div class="no-scrollbar flex flex-1 flex-col overflow-y-auto" bind:this={gridContainer}>
      <svg class="shrink-0" height={gridHeight} {width} bind:this={svgElement}>
        <g bind:this={svgGroupElement}>
          {#each trackOrder as trackId (trackId)}
            {#each parameterOrder[trackId] as parameterId (parameterId)}
              <AutomationCurveWrapper
                {parameterId}
                height={gridDisplayState.getLaneHeight(parameterId)}
                width={innerWidth}
                yPosition={laneYPositions[parameterId]}
              />
            {/each}
          {/each}
        </g>
      </svg>
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

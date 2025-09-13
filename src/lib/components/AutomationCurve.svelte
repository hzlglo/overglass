<script lang="ts">
  import * as d3 from 'd3';
  import { automationDb } from '../stores/database.svelte';
  import type { AutomationPoint } from '../types/automation';
  import { sharedXScale } from './sharedXScale.svelte';
  import SizeObserver from './SizeObserver.svelte';
  import { getThemeColor } from '$lib/utils/utils';

  interface AutomationCurveProps {
    parameterId: string;
    minValue: number;
    maxValue: number;
  }

  let { parameterId, minValue, maxValue }: AutomationCurveProps = $props();

  let width = $state(400);
  let height = $state(150);

  // State
  let svgElement = $state<SVGElement>();
  let automationPoints = $state<AutomationPoint[]>([]);

  // Derived values
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let innerHeight = $derived(height - margin.top - margin.bottom);

  $inspect('innerheight', innerHeight);

  let xScale = $derived(sharedXScale.getZoomedXScale());

  let yScale = $derived(d3.scaleLinear().domain([minValue, maxValue]).range([innerHeight, 0]));

  let line = $derived(
    d3
      .line<AutomationPoint>()
      .x((d) => xScale(d.timePosition))
      .y((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  let area = $derived(
    d3
      .area<AutomationPoint>()
      .x((d) => xScale(d.timePosition))
      .y0(innerHeight)
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  // Load automation points
  $effect(async () => {
    const points = await automationDb.get().automation.getAutomationPoints(parameterId);
    automationPoints = points;
  });

  // Setup SVG structure with zoom
  let svg = $derived(d3.select(svgElement));
  let svgGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();

  $effect(() => {
    if (!svg) {
      return;
    }
    svg.selectAll('*').remove();
    // Create clipping path definition
    const defs = svg.append('defs');
    defs
      .append('clipPath')
      .attr('id', `clip-${parameterId}`)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    svgGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('clip-path', `url(#clip-${parameterId})`);
  });

  $effect(() => {
    let zoom = sharedXScale.getZoom();
    if (!svgGroup) {
      return;
    }
    svg.call(zoom);
  });

  // Draw grid lines
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      // Remove existing grid
      svgGroup.selectAll('.grid').remove();

      // X-axis grid
      svgGroup
        .append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(xScale)
            .tickSize(-innerHeight)
            .tickFormat(() => ''),
        )
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

      // Y-axis grid
      svgGroup
        .append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat(() => ''),
        )
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);
    }
  });

  // Draw area and line
  $effect(() => {
    if (svgGroup && automationPoints.length > 0) {
      // Remove existing paths
      svgGroup.selectAll('.area, .line').remove();

      // Draw area
      svgGroup
        .append('path')
        .attr('class', 'area')
        .datum(automationPoints)
        .attr('fill', 'var(--color-primary)')
        .attr('fill-opacity', 0.2)
        .attr('d', area);

      // Draw line
      svgGroup
        .append('path')
        .attr('class', 'line')
        .datum(automationPoints)
        .attr('fill', 'none')
        .attr('stroke', 'var(--color-primary)')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 2)
        .attr('d', line);
    }
  });

  // Draw points
  $effect(() => {
    if (svgGroup && automationPoints.length > 0) {
      // Remove existing points
      svgGroup.selectAll('.point').remove();

      // Add new points
      svgGroup
        .selectAll('.point')
        .data(automationPoints)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', (d) => xScale(d.timePosition))
        .attr('cy', (d) => yScale(d.value))
        .attr('r', 3)
        .attr('fill', 'var(--color-primary)')
        .attr('fill-opacity', 0.4)
        .attr('stroke', 'var(--color-primary)')
        .attr('stroke-width', 1);
    }
  });
</script>

<div class="automation-curve-container">
  <div class="bg-base-100 border-base-300 h-[150px] rounded-lg border">
    <SizeObserver bind:width bind:height>
      <svg bind:this={svgElement} {width} {height} class="overflow-visible"></svg>
    </SizeObserver>
  </div>
</div>

<style>
  .automation-curve-container :global(.grid line) {
    stroke: currentColor;
    stroke-opacity: 0.2;
  }

  .automation-curve-container :global(.domain) {
    stroke: currentColor;
    stroke-opacity: 0.5;
  }

  .automation-curve-container :global(.tick text) {
    fill: currentColor;
    font-size: 11px;
  }
</style>

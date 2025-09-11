<script lang="ts">
  import * as d3 from 'd3';
  import { automationDb } from '../stores/database.svelte';
  import type { AutomationPoint } from '../types/automation';

  interface AutomationCurveProps {
    parameterId: string;
    parameterName: string;
    minValue: number;
    maxValue: number;
    minTime: number;
    maxTime: number;
    height?: number;
    width?: number;
  }

  let {
    parameterId,
    parameterName,
    minValue,
    maxValue,
    minTime,
    maxTime,
    height = 150,
    width = 400,
  }: AutomationCurveProps = $props();

  // State
  let svgElement = $state<SVGElement>();
  let automationPoints = $state<AutomationPoint[]>([]);

  // Derived values
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  let innerWidth = $derived(width - margin.left - margin.right);
  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(d3.scaleLinear().domain([minTime, maxTime]).range([0, innerWidth]));

  let yScale = $derived(d3.scaleLinear().domain([minValue, maxValue]).range([innerHeight, 0]));

  let line = $derived(
    d3
      .line<AutomationPoint>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  let area = $derived(
    d3
      .area<AutomationPoint>()
      .x((d) => xScale(d.time))
      .y0(innerHeight)
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  // Load automation points
  $effect(async () => {
    const points = await automationDb.getAutomationPoints(parameterId);
    automationPoints = points;
  });

  // Clear SVG when element changes
  $effect(() => {
    if (svgElement) {
      d3.select(svgElement).selectAll('*').remove();
    }
  });

  // Setup SVG structure
  let svgGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();
  $effect(() => {
    if (svgElement) {
      const svg = d3.select(svgElement);
      svgGroup = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    }
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
        .attr('fill', 'rgba(59, 130, 246, 0.1)')
        .attr('d', area);

      // Draw line
      svgGroup
        .append('path')
        .attr('class', 'line')
        .datum(automationPoints)
        .attr('fill', 'none')
        .attr('stroke', 'rgb(59, 130, 246)')
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
        .attr('cx', (d) => xScale(d.time))
        .attr('cy', (d) => yScale(d.value))
        .attr('r', 3)
        .attr('fill', 'rgb(59, 130, 246)')
        .attr('stroke', 'white')
        .attr('stroke-width', 1);
    }
  });

  // Draw axes
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      // Remove existing axes
      svgGroup.selectAll('.axis').remove();

      // X-axis
      svgGroup
        .append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat((d) => `${d}s`));

      // Y-axis
      svgGroup
        .append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale).tickFormat((d) => d3.format('.2f')(d)));
    }
  });

  // Draw axis labels
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      // Remove existing labels
      svgGroup.selectAll('.axis-label').remove();

      // Y-axis label
      svgGroup
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - innerHeight / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'currentColor')
        .text('Value');

      // X-axis label
      svgGroup
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'currentColor')
        .text('Time (s)');
    }
  });
</script>

<div class="automation-curve-container">
  <div class="mb-2">
    <h4 class="text-base-content/80 text-sm font-medium">
      {parameterName}
    </h4>
  </div>
  <div class="bg-base-100 border-base-300 rounded-lg border p-3">
    <svg bind:this={svgElement} {width} {height} class="overflow-visible"></svg>
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

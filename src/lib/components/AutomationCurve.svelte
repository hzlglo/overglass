<script lang="ts">
  import * as d3 from 'd3';
  import { automationDb } from '../stores/database.svelte';
  import type { AutomationPoint, Parameter, ParameterStats } from '../types/automation';
  import { sharedXScale } from './sharedXScale.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    parameter: Parameter & ParameterStats;
    height: number;
    width: number;
    yPosition: number;
  }

  let { parameterId, parameter, height, width, yPosition }: AutomationCurveProps = $props();

  // State
  let gElement = $state<SVGElement>();
  let automationPoints = $state<AutomationPoint[]>([]);

  $inspect('here', gElement?.getBoundingClientRect());

  // Derived values
  const margin = { top: 1, right: 0, bottom: 1, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());

  let yScale = $derived(
    d3.scaleLinear().domain([parameter.minValue, parameter.maxValue]).range([innerHeight, 0]),
  );

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

  let svgGroup = $derived(gElement ? d3.select(gElement) : undefined);

  // Draw area and line
  $effect(() => {
    if (svgGroup && automationPoints.length > 0) {
      const updatedAutomationPoints = automationPoints.map((point) => ({
        ...point,
        timePosition: point.timePosition < 0 ? 0 : point.timePosition,
      }));
      // Remove existing paths
      svgGroup.selectAll('.area, .line').remove();

      // Draw area
      svgGroup
        .append('path')
        .attr('class', 'area')
        .datum(updatedAutomationPoints)
        .attr('fill', 'var(--color-primary)')
        .attr('fill-opacity', 0.2)
        .attr('d', area);

      // Draw line
      svgGroup
        .append('path')
        .attr('class', 'line')
        .datum(updatedAutomationPoints)
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

<g
  id={`${parameterId}-${parameter.parameterName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
></g>

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

<script lang="ts">
  import * as d3 from 'd3';
  import type { AutomationPoint, Parameter, ParameterStats } from '../types/automation';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { clamp } from '$lib/utils/utils';
  import { sortBy } from 'lodash';
  import { automationDb } from '$lib/stores/database.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    parameter: Parameter & ParameterStats;
    height: number;
    width: number;
    yPosition: number;
    automationPoints: AutomationPoint[];
  }

  let { parameterId, parameter, height, width, yPosition, automationPoints }: AutomationCurveProps =
    $props();

  // State
  let gElement = $state<SVGElement>();

  $inspect('here', gElement?.getBoundingClientRect());

  // Derived values
  const margin = { top: 1, right: 0, bottom: 1, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());

  let yScale = $derived(d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]));
  // scale used for dragging points
  let yDiffScale = $derived(
    d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, 0 - innerHeight]),
  );

  let lineFn = $derived(
    d3
      .line<AutomationPoint>()
      .x((d) => xScale(d.timePosition))
      .y((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  let areaFn = $derived(
    d3
      .area<AutomationPoint>()
      .x((d) => xScale(d.timePosition))
      .y0(innerHeight)
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear),
  );

  let svgGroup = $derived(gElement ? d3.select(gElement) : undefined);

  let { area, line } = $derived.by(() => {
    if (!svgGroup) {
      return { area: undefined, line: undefined };
    }
    svgGroup.selectAll('.area, .line').remove();
    // Draw area
    const area = svgGroup
      .append('path')
      .attr('class', 'area')
      .attr('fill', 'var(--color-secondary)')
      .attr('fill-opacity', 0.2)
      .style('pointer-events', 'none');

    // Draw line
    const line = svgGroup
      .append('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-secondary)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');
    return { area: area, line: line };
  });

  $effect(() => {
    if (area && line) {
      // Ensure points are within the range of the xScale
      const updatedAutomationPoints = sortBy(
        automationPoints.map((point) => ({
          ...point,
          timePosition: point.timePosition < 0 ? 0 : point.timePosition,
        })),
        (p) => p.timePosition,
      );
      area.datum(updatedAutomationPoints).attr('d', areaFn);
      line.datum(updatedAutomationPoints).attr('d', lineFn);
    }
  });

  // Draw points
  let points = $derived.by(() => {
    // Add new points
    let circles = svgGroup
      ?.selectAll<SVGCircleElement, AutomationPoint>('.point')
      .data(automationPoints, (p) => p.id)
      .join(
        (enter) =>
          enter
            .append('circle')
            .attr('class', 'point')
            .attr('r', 3)
            .attr('fill', 'var(--color-secondary)')
            .attr('fill-opacity', 0.4)
            .attr('stroke', 'var(--color-secondary)')
            .attr('stroke-width', 1),
        (update) => update,
        (exit) => exit.remove(),
      );

    circles?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));

    return circles;
  });
  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());

  $effect(() => {
    const drag = d3
      .drag()
      .on(
        'start',
        (
          event: d3.D3DragEvent<SVGCircleElement, AutomationPoint, SVGElement>,
          d: AutomationPoint,
        ) => {
          if (!selectedPoints.has(d)) {
            sharedDragSelect.setBrushSelection(null);
            selectedPoints.clear();
            selectedPoints.add(d);
          }
        },
      )
      .on('drag', (event, d) => {
        const dx = event.dx;
        const dy = event.dy;
        selectedPoints.forEach((p) => {
          p.timePosition = p.timePosition + sharedXScale.getDataDeltaForScreenDelta(dx);
          // TODO do we ever need to support values outside of 0-1?
          p.value = clamp(p.value + yDiffScale.invert(dy), 0, 1);
        });
        points?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));
      })
      .on('end', async (event, d) => {
        await automationDb.get().automation.bulkSetAutomationPoints(Array.from(selectedPoints));
      });
    points?.call(drag, []);
  });
</script>

<g
  id={`${parameterId}-${parameter.parameterName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
></g>

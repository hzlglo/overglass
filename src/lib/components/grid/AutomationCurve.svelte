<script lang="ts">
  import * as d3 from 'd3';
  import type { AutomationPoint, Parameter, ParameterStats } from '../../types/automation';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { clamp } from '$lib/utils/utils';
  import { sortBy } from 'lodash';
  import { trackDb } from '$lib/stores/trackDb.svelte';

  interface AutomationCurveProps {
    parameterId: string;
    parameter: Parameter & ParameterStats;
    height: number;
    width: number;
    yPosition: number;
    automationPoints: AutomationPoint[];
    color: string | undefined;
  }

  let {
    parameterId,
    parameter,
    height,
    width,
    yPosition,
    automationPoints,
    color: colorProp,
  }: AutomationCurveProps = $props();

  // State
  let gElement = $state<SVGElement>();

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

  let color = $derived(colorProp ?? 'var(--color-secondary)');

  let { area, line } = $derived.by(() => {
    if (!svgGroup) {
      return { area: undefined, line: undefined };
    }
    svgGroup.selectAll('.area, .line').remove();
    // Draw area
    const area = svgGroup
      .append('path')
      .attr('class', 'area')
      .attr('fill', color)
      .attr('fill-opacity', 0.2)
      .style('pointer-events', 'none');

    // Draw line
    const line = svgGroup
      .append('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', color)
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
        (enter) => enter.append('circle'),
        (update) => update,
        (exit) => exit.remove(),
      );

    circles
      ?.attr('cx', (d) => xScale(d.timePosition))
      .attr('cy', (d) => yScale(d.value))
      .attr('class', 'point')
      .attr('r', 3)
      .attr('fill', color)
      .attr('fill-opacity', 0.4)
      .attr('stroke', color)
      .attr('stroke-width', 1);

    return circles;
  });

  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());
  $inspect('selectedPoints', selectedPoints);
  let thisParameterSelectedPoints = $derived(
    selectedPoints.filter((p) => p.parameterId === parameterId),
  );

  let drag = $derived(
    d3
      .drag()
      .on(
        'start',
        (
          event: d3.D3DragEvent<SVGCircleElement, AutomationPoint, SVGElement>,
          d: AutomationPoint,
        ) => {
          if (!selectedPoints.find((p) => p.id === d.id)) {
            sharedDragSelect.setBrushSelection(null);
            sharedDragSelect.setSelectedPoints([d]);
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
        await trackDb.get().automation.bulkSetAutomationPoints(selectedPoints);
        await trackDb.refreshData();
      }),
  );

  $effect(() => {
    points?.call(drag, []);
  });

  // Draw selected points
  let selectedPointsCircles = $derived.by(() => {
    // Add new points
    let circles = svgGroup
      ?.selectAll<SVGCircleElement, AutomationPoint>('.point.selected')
      .data(thisParameterSelectedPoints, (p) => p.id)
      .join(
        (enter) => enter.append('circle'),
        (update) => update,
        (exit) => exit.remove(),
      );

    circles
      ?.attr('cx', (d) => xScale(d.timePosition))
      .attr('cy', (d) => yScale(d.value))
      .attr('class', 'point selected')
      .attr('r', 3)
      .attr('fill', 'var(--color-base-content)')
      .attr('fill-opacity', 0.4)
      .attr('stroke', 'var(--color-base-content)')
      .attr('stroke-width', 1);
    return circles;
  });
  $effect(() => {
    selectedPointsCircles?.call(drag, []);
  });
</script>

<g
  id={`${parameterId}-${parameter.parameterName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
  {color}
></g>

<script lang="ts">
  import * as d3 from 'd3';
  import type { AutomationPoint, Parameter, ParameterStats } from '../../types/automation';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { clamp } from '$lib/utils/utils';
  import { sortBy } from 'lodash';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import { actionsDispatcher } from './actionsDispatcher.svelte';

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

  $inspect('automationcurve', {
    parameterId,
    parameter,
    height,
    width,
    yPosition,
    automationPoints,
    color: colorProp,
  });

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

  // Background rectangle to capture events
  // let backgroundRect = $derived.by(() => {
  //   if (!svgGroup) return undefined;

  //   svgGroup.selectAll('.background-rect').remove();
  //   return svgGroup
  //     .append('rect')
  //     .attr('class', 'background-rect')
  //     .attr('x', 0)
  //     .attr('y', 0)
  //     .attr('width', innerWidth)
  //     .attr('height', innerHeight)
  //     .attr('fill', 'transparent')
  //     .style('cursor', 'crosshair');
  // });

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

  const drawLineAndArea = (points: AutomationPoint[]) => {
    if (!area || !line) {
      return;
    }
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
  };

  $effect(() => {
    if (area && line) {
      drawLineAndArea(automationPoints);
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
      .attr('cx', (d) => xScale(d.timePosition))
      .attr('cy', (d) => yScale(d.value))
      .attr('class', 'point')
      .attr('r', 3)
      .attr('fill', color)
      .attr('fill-opacity', 0.4)
      .attr('stroke', color)
      .attr('stroke-width', 1);

    return circles;
  });

  $effect(() => {
    sharedDragSelect.registerDragHandler(parameterId, () => {
      points?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));
    });
  });

  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());

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
            sharedDragSelect.clear();
            sharedDragSelect.setSelectedPoints([d]);
          }
        },
      )
      .on('drag', (event, d) => {
        sharedDragSelect.dragEvent({
          dx: event.dx,
          dy: event.dy,
          yDiffScale,
        });
      })
      .on('end', async (event, d) => {
        await sharedDragSelect.dragEnd();
      }),
  );

  $effect(() => {
    points?.call(drag, []);
  });

  // Add event listeners for interactive actions
  $effect(() => {
    if (!points) return;

    // Add double-click and right-click event listeners to points
    points
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        actionsDispatcher.handleDoubleClick(event, 'automationPoint', {
          parameterId,
          selectedAutomationPoints: selectedPoints.length > 0 ? selectedPoints : [d],
        });
      })
      .on('contextmenu', (event, d) => {
        console.log('point contextmenu', event, d);
        event.stopPropagation();
        actionsDispatcher.handleRightClick(event, 'parameter', {
          parameterId,
          selectedAutomationPoints: selectedPoints.length > 0 ? selectedPoints : [d],
        });
      });
  });

  // Add event listeners for parameter area (for adding points)
  // $effect(() => {
  //   if (!backgroundRect) return;

  //   backgroundRect
  //     .on('dblclick', (event) => {
  //       const [mouseX, mouseY] = d3.pointer(event);
  //       const timePosition = xScale.invert(mouseX);
  //       const value = yScale.invert(mouseY);

  //       actionsDispatcher.handleDoubleClick(event, 'parameter', {
  //         parameterId,
  //         timePosition,
  //         value: clamp(value, 0, 1),
  //         selectedAutomationPoints: selectedPoints,
  //       });
  //     })
  //     .on('contextmenu', (event) => {
  //       const [mouseX, mouseY] = d3.pointer(event);
  //       const timePosition = xScale.invert(mouseX);
  //       const value = yScale.invert(mouseY);

  //       actionsDispatcher.handleRightClick(event, 'parameter', {
  //         parameterId,
  //         timePosition,
  //         value: clamp(value, 0, 1),
  //         selectedAutomationPoints: selectedPoints,
  //       });
  //     });
  // });
</script>

<g
  id={`${parameterId}-${parameter.parameterName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
  {color}
></g>

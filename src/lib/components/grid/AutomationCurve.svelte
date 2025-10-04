<script lang="ts">
  import * as d3 from 'd3';
  import type { AutomationPoint, Parameter } from '../../database/schema';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { sortBy } from 'lodash';
  import { actionsDispatcher } from './actionsDispatcher.svelte';
  import { getAutomationLaneYAxis } from './laneConstants';

  interface AutomationCurveProps {
    parameterId: string;
    parameter: Parameter;
    height: number;
    width: number;
    automationPoints: AutomationPoint[];
    color: string | undefined;
  }

  let {
    parameterId,
    parameter,
    height,
    automationPoints,
    color: colorProp,
  }: AutomationCurveProps = $props();

  // State
  let gElement = $state<SVGElement>();

  // Derived values
  let { innerHeight, yScale, margin } = $derived(getAutomationLaneYAxis(height));
  let xScale = $derived(sharedXScale.getZoomedXScale());

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
  let highlightColor = 'var(--color-base-content)';

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

  const drawLineAndArea = (automationPoints: AutomationPoint[]) => {
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
    return svgGroup
      ?.selectAll<SVGCircleElement, AutomationPoint>('.point')
      .data(automationPoints, (p) => p.id)
      .join(
        (enter) => enter.append('circle'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('cx', (d) => xScale(d.timePosition))
      .attr('cy', (d) => yScale(d.value))
      .attr('class', 'point')
      .attr('r', 3)
      .attr('fill', color)
      .attr('fill-opacity', 0.4)
      .attr('stroke', color)
      .attr('stroke-width', 1);
  });

  $effect(() => {
    sharedDragSelect.registerDragHandler(parameterId, () => {
      points?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));
    });
  });

  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());
  let selectedPointIds = $derived(sharedDragSelect.getSelectedPointIds());

  $effect(() => {
    points
      ?.attr('fill', (d) => (selectedPointIds.has(d.id) ? highlightColor : color))
      .attr('fill-opacity', (d) => (selectedPointIds.has(d.id) ? 1 : 0.4))
      .attr('stroke-opacity', (d) => (selectedPointIds.has(d.id) ? 0.5 : 1));
  });

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
          event,
          currentTimePosition: d.timePosition,
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
        // event.stopPropagation();
        actionsDispatcher.handleDoubleClick(event, 'automationPoint', {
          parameterId,
          selectedAutomationPoints: selectedPoints.length > 0 ? selectedPoints : [d],
        });
      })
      .on('contextmenu', (event, d) => {
        actionsDispatcher.handleRightClick(event, 'parameter', {
          parameterId,
          selectedAutomationPoints: selectedPoints.length > 0 ? selectedPoints : [d],
        });
      });
  });
</script>

<g
  id={`${parameterId}-${parameter.parameterName}`}
  bind:this={gElement}
  transform={`translate(0,${margin.top})`}
  {color}
></g>

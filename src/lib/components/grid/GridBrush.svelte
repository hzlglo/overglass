<script lang="ts">
  import * as d3 from 'd3';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import type { AutomationPoint, MuteTransition } from '$lib/database/schema';
  import { actionsDispatcher, type GridEventContext } from './actionsDispatcher.svelte';
  import { clamp } from 'lodash';
  import { getAutomationLaneYAxis } from './laneConstants';

  let {
    muteTransitionsByTrackId,
    automationPointsByParameterId,
  }: {
    muteTransitionsByTrackId: Record<string, MuteTransition[]>;
    automationPointsByParameterId: Record<string, AutomationPoint[]>;
  } = $props();

  let lanes = $derived(gridDisplayState.getLanes());

  let brushGElement = $state<SVGGElement>();
  let brushG = $derived(brushGElement ? d3.select(brushGElement) : undefined);
  let brushHandler = async (event: unknown) => {
    if (!event.selection) {
      sharedDragSelect.setBrushSelection(null);
      sharedDragSelect.setSelectedLanes([]);
      sharedDragSelect.setSelectedPoints([]);
      return;
    }
    let [[x0, y0], [x1, y1]] = event.selection;

    // Ensure y0 < y1
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (x0 > x1) [x0, x1] = [x1, x0];

    let { sourceEvent } = event;
    if (sourceEvent && brushG) {
      // Snap y0 and y1 to allowed values
      const firstLaneIndex = lanes.findIndex((l) => l.top < y0 && l.bottom > y0);
      const lastLaneIndex = lanes.findIndex((l) => l.top < y1 && l.bottom > y1);
      if (firstLaneIndex === -1 || lastLaneIndex === -1) {
        return;
      }

      y0 = lanes[firstLaneIndex].top;
      y1 = lanes[lastLaneIndex].bottom;

      // Update the brush rectangle visually
      brushG.call(brush.move, [
        [x0, y0],
        [x1, y1],
      ]);
      let selectedLanes = lanes.slice(firstLaneIndex, lastLaneIndex + 1);
      sharedDragSelect.setSelectedLanes(selectedLanes);

      const xScale = sharedXScale.getZoomedXScale();
      let [startTime, endTime] = [xScale.invert(x0), xScale.invert(x1)];
      let selectedParameterIds = selectedLanes
        .filter((l) => l.type === 'parameter')
        .map((l) => l.id);
      let selectedPoints = selectedParameterIds.flatMap((parameterId) =>
        automationPointsByParameterId[parameterId].filter(
          (p) => p.timePosition >= startTime && p.timePosition <= endTime,
        ),
      );
      sharedDragSelect.setSelectedPoints(selectedPoints);
      let selectedMuteTransitions = selectedLanes
        .filter((l) => l.type === 'track')
        .flatMap((l) => muteTransitionsByTrackId[l.id])
        .filter((t) => t.timePosition >= startTime && t.timePosition <= endTime);
      sharedDragSelect.setSelectedMuteTransitions(selectedMuteTransitions);
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
    sharedDragSelect.setClearBrush(() => {
      brushG?.call(brush.clear);
    });
  });
  $effect(() => {
    if (!brushG) {
      return;
    }
    brushG.call(brush);
  });

  const getLaneForY = (y: number) => {
    return lanes.find((l) => l.top <= y && l.bottom > y);
  };
  const xScale = $derived(sharedXScale.getZoomedXScale());
  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());
  let selectedMuteTransitions = $derived(sharedDragSelect.getSelectedMuteTransitions());

  const getContextForEvent = (event: MouseEvent): ['parameter' | 'track', GridEventContext] => {
    const [mouseX, mouseY] = d3.pointer(event);

    const lane = getLaneForY(mouseY);
    if (!lane) {
      throw new Error(`No lane found for event: ${event}`);
    }

    const timePosition = xScale.invert(mouseX);
    let value = undefined;
    if (lane.type === 'parameter') {
      let { yScale } = getAutomationLaneYAxis(lane.bottom - lane.top, lane.top);
      value = yScale.invert(mouseY);
    }
    return [
      lane.type,
      {
        parameterId: lane.type === 'parameter' ? lane.id : undefined,
        trackId: lane.type === 'track' ? lane.id : undefined,
        timePosition,
        value: value !== undefined ? clamp(value, 0, 1) : undefined,
        selectedAutomationPoints: selectedPoints,
        selectedMuteTransitions: selectedMuteTransitions,
      },
    ];
  };

  $effect(() => {
    if (!brushG) return;

    brushG
      .on('dblclick', (event) => {
        actionsDispatcher.handleDoubleClick(event, ...getContextForEvent(event));
      })
      .on('contextmenu', (event) => {
        console.log('brush contextmenu', event, getContextForEvent(event));
        actionsDispatcher.handleRightClick(event, ...getContextForEvent(event));
      });
  });
</script>

<g bind:this={brushGElement} class="brush-group"></g>

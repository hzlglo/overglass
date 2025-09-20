<script lang="ts">
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import * as d3 from 'd3';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

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
    let { sourceEvent } = event;
    if (sourceEvent && brushG) {
      // Snap y0 and y1 to allowed values
      const firstLaneIndex = lanes.findIndex((l) => l.top <= y0);
      const lastLaneIndex = lanes.findIndex((l) => l.bottom >= y1);
      y0 = lanes[firstLaneIndex].top;
      y1 = lanes[lastLaneIndex].bottom;

      // Ensure y0 < y1
      if (y0 > y1) [y0, y1] = [y1, y0];

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
      let selectedPoints = await trackDb.get().automation.getAutomationPoints({
        parameterIds: selectedParameterIds,
        startTime,
        endTime,
      });
      sharedDragSelect.setSelectedPoints(selectedPoints);
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
    if (!brushG) {
      return;
    }
    brushG.call(brush);
  });
</script>

<g bind:this={brushGElement} class="brush-group"></g>

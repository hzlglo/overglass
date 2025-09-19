<script lang="ts">
  import { useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import * as d3 from 'd3';
  import { flatten, groupBy } from 'lodash';
  import { SvelteSet } from 'svelte/reactivity';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { sharedXScale } from './sharedXScale.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

  let lanes = $derived(gridDisplayState.getLanes());

  // Load automation points
  let automationPointsStore = useTrackDbQuery(
    (trackDb) => trackDb.automation.getAutomationPoints({}),
    [],
  );
  let automationPointsByParameterId = $derived(
    groupBy(automationPointsStore.getResult(), (point) => point.parameterId),
  );

  let brushGElement = $state<SVGGElement>();
  let brushG = $derived(brushGElement ? d3.select(brushGElement) : undefined);
  let brushHandler = (event) => {
    if (!event.selection) {
      sharedDragSelect.setBrushSelection(null);
      sharedDragSelect.setSelectedLanes([]);
      sharedDragSelect.getSelectedPoints().clear();
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
      let selectedPoints = flatten(
        selectedLanes
          .filter((l) => l.type === 'parameter')
          .map((l) =>
            automationPointsByParameterId[l.id].filter(
              (p) => p.timePosition >= startTime && p.timePosition <= endTime,
            ),
          ),
      );
      sharedDragSelect.setSelectedPoints(new SvelteSet(selectedPoints));
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

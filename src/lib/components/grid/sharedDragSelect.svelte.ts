import type { AutomationPoint } from '$lib/database/schema';
import { SvelteSet } from 'svelte/reactivity';
import type { LaneDisplay } from './gridDisplayState.svelte';
import { sharedXScale } from './sharedXScale.svelte';
import { clamp } from '$lib/utils/utils';

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  let selectedLanes: null | LaneDisplay[] = $state(null);
  let selectedPoints: AutomationPoint[] = $state([]);
  return {
    getBrushSelection: () => brushSelection,
    setBrushSelection: (
      brushSelectionInner: null | { x0: number; y0: number; x1: number; y1: number },
    ) => {
      brushSelection = brushSelectionInner;
      if (!brushSelectionInner) {
        selectedPoints = [];
        return;
      }
    },
    getSelectedLanes: () => selectedLanes,
    setSelectedLanes: (selectedLanesInner: null | LaneDisplay[]) => {
      selectedLanes = selectedLanesInner;
    },
    getSelectedPoints: () => selectedPoints,
    setSelectedPoints: (selectedPointsInner: AutomationPoint[]) => {
      selectedPoints = selectedPointsInner;
    },
    dragEvent: (
      event: d3.D3DragEvent<SVGCircleElement, AutomationPoint, SVGElement>,
      yDiffScale: d3.ScaleLinear<number, number>,
    ) => {
      const dx = event.dx;
      const dy = event.dy;
      selectedPoints.forEach((p) => {
        p.timePosition = p.timePosition + sharedXScale.getDataDeltaForScreenDelta(dx);
        p.value = clamp(p.value + yDiffScale.invert(dy), 0, 1);
      });
      // points?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

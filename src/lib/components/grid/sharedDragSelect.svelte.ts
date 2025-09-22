import type { AutomationPoint } from '$lib/database/schema';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { LaneDisplay } from './gridDisplayState.svelte';
import { sharedXScale } from './sharedXScale.svelte';
import { clamp } from '$lib/utils/utils';
import { groupBy } from 'lodash';

type DragHandlerParams = {
  event: d3.D3DragEvent<SVGCircleElement, AutomationPoint, SVGElement>;
  yDiffScale: d3.ScaleLinear<number, number>;
};

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  let selectedLanes: null | LaneDisplay[] = $state(null);
  let selectedPoints: AutomationPoint[] = $state([]);
  let selectedPointsByParameterId = groupBy(selectedPoints, (p) => p.parameterId);

  let dragHandlers: SvelteMap<string, (params: DragHandlerParams) => void> = $state(
    new SvelteMap(),
  );

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
    registerDragHandler: (parameterId: string, handler: (params: DragHandlerParams) => void) => {
      dragHandlers.set(parameterId, handler);
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
      dragHandlers.forEach((handler, parameterId) => {
        handler({ event, yDiffScale });
      });
      // selectedPoints
      // points?.attr('cx', (d) => xScale(d.timePosition)).attr('cy', (d) => yScale(d.value));
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

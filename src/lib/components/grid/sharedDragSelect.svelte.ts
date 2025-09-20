import type { AutomationPoint } from '$lib/database/schema';
import { SvelteSet } from 'svelte/reactivity';
import type { LaneDisplay } from './gridDisplayState.svelte';

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
  };
};

export const sharedDragSelect = getSharedDragSelect();

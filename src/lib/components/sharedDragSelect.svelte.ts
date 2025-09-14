import type { LaneDisplay } from './gridDisplayState.svelte';

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  let selectedLanes: null | LaneDisplay[] = $state(null);
  return {
    getBrushSelection: () => brushSelection,
    setBrushSelection: (
      brushSelectionInner: null | { x0: number; y0: number; x1: number; y1: number },
    ) => {
      brushSelection = brushSelectionInner;
    },
    getSelectedLanes: () => selectedLanes,
    setSelectedLanes: (selectedLanesInner: null | LaneDisplay[]) => {
      selectedLanes = selectedLanesInner;
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

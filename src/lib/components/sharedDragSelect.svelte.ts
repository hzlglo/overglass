import type { AutomationPoint } from '$lib/database/schema';
import { automationDb } from '$lib/stores/database.svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { LaneDisplay } from './gridDisplayState.svelte';
import { sharedXScale } from './sharedXScale.svelte';

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  let selectedLanes: null | LaneDisplay[] = $state(null);
  let selectedPoints: SvelteSet<AutomationPoint> = $state(new SvelteSet());
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
    getSelectedPoints: () => selectedPoints,
    setSelectedPoints: (selectedPointsInner: SvelteSet<AutomationPoint>) => {
      selectedPoints = selectedPointsInner;
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

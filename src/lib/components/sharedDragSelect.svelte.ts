import type { AutomationDatabase } from '$lib/database/duckdb';
import { fromPairs, get, sum } from 'lodash';
import { SvelteSet } from 'svelte/reactivity';

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  return {
    getBrushSelection: () => brushSelection,
    setBrushSelection: (
      brushSelectionInner: null | { x0: number; y0: number; x1: number; y1: number },
    ) => {
      brushSelection = brushSelectionInner;
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

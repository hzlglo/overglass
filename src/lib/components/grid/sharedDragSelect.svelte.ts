import type { AutomationPoint } from '$lib/database/schema';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { LaneDisplay } from './gridDisplayState.svelte';
import { sharedXScale } from './sharedXScale.svelte';
import { groupBy, keyBy, keys, clamp } from 'lodash';
import type { MuteTransition } from '$lib/database/schema';
import { trackDb } from '$lib/stores/trackDb.svelte';
import { MuteTransitionService } from '$lib/database/services/muteTransitionService';

const getSharedDragSelect = () => {
  let brushSelection: null | { x0: number; y0: number; x1: number; y1: number } = $state(null);
  let selectedLanes: null | LaneDisplay[] = $state(null);
  let selectedPoints: AutomationPoint[] = $state([]);
  let selectedPointIds = $derived(new Set(selectedPoints.map((p) => p.id)));
  let selectedMuteTransitions: MuteTransition[] = $state([]);
  let selectedMuteTransitionIds = $derived(new Set(selectedMuteTransitions.map((t) => t.id)));
  let selectedMuteTransitionsByTrackId = $derived(
    groupBy(selectedMuteTransitions, (t) => t.trackId),
  );

  let allMuteTransitionsByTrackId: Record<string, MuteTransition[]> = $state.raw({});

  let dragHandlers: SvelteMap<string, () => void> = $state(new SvelteMap());

  let clearBrush: () => void = $state(() => {});
  const clear = () => {
    brushSelection = null;
    selectedPoints = [];
    selectedLanes = null;
    selectedMuteTransitions = [];
    clearBrush();
  };

  return {
    clear,
    setClearBrush: (clearBrushInner: () => void) => {
      clearBrush = clearBrushInner;
    },
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
    getSelectedPointIds: () => selectedPointIds,
    getSelectedMuteTransitionIds: () => selectedMuteTransitionIds,
    getSelectedMuteTransitions: () => selectedMuteTransitions,
    setSelectedMuteTransitions: (selectedMuteTransitionsInner: MuteTransition[]) => {
      selectedMuteTransitions = selectedMuteTransitionsInner;
    },
    registerDragHandler: (parameterId: string, handler: () => void) => {
      dragHandlers.set(parameterId, handler);
    },
    dragEvent: ({
      event,
      currentTimePosition,
      yDiffScale,
    }: {
      event: d3.D3DragEvent<SVGCircleElement, AutomationPoint, SVGElement>;
      currentTimePosition: number;
      yDiffScale?: d3.ScaleLinear<number, number>;
    }) => {
      const shouldSnapToGrid = !(event.sourceEvent?.altKey || event.sourceEvent?.metaKey);
      let diffSeconds = sharedXScale.getDataDeltaForScreenDelta(event.dx);
      if (shouldSnapToGrid) {
        const updatedPointPixels = event.x;
        const updatedPointBars = sharedXScale.getZoomedXScaleBars().invert(updatedPointPixels);
        const snappedPointBars = sharedXScale.getSnapPointToGrid()(updatedPointBars);
        const snappedPointPixels = sharedXScale.getZoomedXScaleBars()(snappedPointBars);
        const snappedPointSeconds = sharedXScale.getZoomedXScale().invert(snappedPointPixels);
        diffSeconds = snappedPointSeconds - currentTimePosition;
      }

      selectedPoints.forEach((p) => {
        p.timePosition = p.timePosition + diffSeconds;
        if (yDiffScale) {
          p.value = clamp(p.value + yDiffScale.invert(event.dy), 0, 1);
        }
      });
      keys(selectedMuteTransitionsByTrackId).forEach((trackId) => {
        const allTrackTransitions = allMuteTransitionsByTrackId[trackId];
        const selectedTrackTransitions = selectedMuteTransitionsByTrackId[trackId];
        const movedSelectedTransitions = MuteTransitionService.getMovedMuteTransitions(
          selectedTrackTransitions,
          allTrackTransitions,
          diffSeconds,
        );
        const movedSelectedTransitionsById = keyBy(movedSelectedTransitions, (t) => t.id);
        for (const muteTransition of selectedTrackTransitions) {
          muteTransition.timePosition =
            movedSelectedTransitionsById[muteTransition.id].timePosition;
        }
      });
      dragHandlers.forEach((handler, parameterId) => {
        handler();
      });
    },
    setAllMuteTransitionsByTrackId: (
      allMuteTransitionsByTrackIdInner: Record<string, MuteTransition[]>,
    ) => {
      allMuteTransitionsByTrackId = allMuteTransitionsByTrackIdInner;
    },
    dragEnd: async () => {
      await trackDb.get().automation.bulkSetAutomationPoints(selectedPoints);
      await trackDb.get().muteTransitions.updateMuteTransitions(selectedMuteTransitions);
      await trackDb.refreshData();
      clear();
    },
  };
};

export const sharedDragSelect = getSharedDragSelect();

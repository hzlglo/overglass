import type { AutomationPoint, MuteTransition } from '$lib/database/schema';
import { trackDb } from '$lib/stores/trackDb.svelte';
import { MuteTransitionService } from '$lib/database/services/muteTransitionService';
import { sharedDragSelect } from './sharedDragSelect.svelte';
import { assertNever } from '$lib/utils/utils';

// Action types and their required inputs
export type GridAction =
  | { type: 'mergeClips'; muteTransitions: MuteTransition[] }
  | { type: 'addClip'; trackId: string; timePosition: number }
  | { type: 'addPoint'; parameterId: string; timePosition: number; value: number }
  | { type: 'delete'; automationPoints?: AutomationPoint[]; muteTransitions?: MuteTransition[] }
  | { type: 'simplify'; automationPoints: AutomationPoint[] };

// Context menu item type
export type ContextMenuItem = {
  eventType: string;
  displayName: string;
  callback: () => void;
};

// Context menu state
type ContextMenuState = {
  isVisible: boolean;
  x: number;
  y: number;
  menuItems: ContextMenuItem[];
} | null;

export type GridEventContext = {
  trackId?: string;
  parameterId?: string;
  timePosition?: number;
  value?: number;
  selectedAutomationPoints?: AutomationPoint[];
  selectedMuteTransitions?: MuteTransition[];
};

const pluralize = (count: number, singular: string, plural?: string) => {
  return count <= 1 ? singular : (plural ?? singular + 's');
};

const getActionsDispatcher = () => {
  let contextMenuState = $state<ContextMenuState>(null);

  const showContextMenu = (x: number, y: number, menuItems: ContextMenuItem[]) => {
    contextMenuState = {
      isVisible: true,
      x,
      y,
      menuItems,
    };
  };

  const hideContextMenu = () => {
    contextMenuState = null;
  };

  const updateContextWithSharedSelection = (context: GridEventContext): GridEventContext => {
    const selectedAutomationPoints = sharedDragSelect.getSelectedPoints();
    const selectedMuteTransitions = sharedDragSelect.getSelectedMuteTransitions();
    if (selectedAutomationPoints.length > 0) {
      context.selectedAutomationPoints = selectedAutomationPoints;
    }
    if (selectedMuteTransitions.length > 0) {
      context.selectedMuteTransitions = selectedMuteTransitions;
    }
    return context;
  };

  // Event handlers that will be called from DOM event listeners

  const handleDoubleClick = (
    event: MouseEvent,
    elementType: 'track' | 'parameter' | 'automationPoint',
    context: GridEventContext,
  ) => {
    context = updateContextWithSharedSelection(context);
    // Double-click performs default action
    switch (elementType) {
      case 'track':
        if (context.trackId && context.timePosition !== undefined) {
          dispatchAction({
            type: 'addClip',
            trackId: context.trackId,
            timePosition: context.timePosition,
          });
        }
        break;
      case 'parameter':
        if (
          context.parameterId &&
          context.timePosition !== undefined &&
          context.value !== undefined
        ) {
          dispatchAction({
            type: 'addPoint',
            parameterId: context.parameterId,
            timePosition: context.timePosition,
            value: context.value,
          });
        }
        break;
      case 'automationPoint':
        if (context.selectedAutomationPoints?.length) {
          dispatchAction({
            type: 'delete',
            automationPoints: context.selectedAutomationPoints,
          });
        }
        break;
    }
  };

  const handleRightClick = (
    event: MouseEvent,
    elementType: 'track' | 'parameter',
    context: GridEventContext,
  ) => {
    event.preventDefault();
    context = updateContextWithSharedSelection(context);

    const menuItems = createMenuItems(elementType, context);
    showContextMenu(event.clientX, event.clientY, menuItems);
  };

  const createMenuItems = (
    elementType: 'track' | 'parameter',
    context: GridEventContext,
  ): ContextMenuItem[] => {
    const menuItems: ContextMenuItem[] = [];

    switch (elementType) {
      case 'track':
        // Add Clip action
        if (context.trackId && context.timePosition !== undefined) {
          menuItems.push({
            eventType: 'addClip',
            displayName: 'Add Clip',
            callback: () =>
              dispatchAction({
                type: 'addClip',
                trackId: context.trackId!,
                timePosition: context.timePosition!,
              }),
          });
        }

        if (context.selectedMuteTransitions?.length) {
          // Merge Clips action (only if multiple clips selected)
          if (context.selectedMuteTransitions.length > 1) {
            menuItems.push({
              eventType: 'mergeClips',
              displayName: 'Merge Clips',
              callback: () =>
                dispatchAction({
                  type: 'mergeClips',
                  muteTransitions: context.selectedMuteTransitions!,
                }),
            });
          }
        }
        break;

      case 'parameter':
        // Add Point action
        if (
          context.parameterId &&
          context.timePosition !== undefined &&
          context.value !== undefined
        ) {
          menuItems.push({
            eventType: 'addPoint',
            displayName: `Add Point`,
            callback: () =>
              dispatchAction({
                type: 'addPoint',
                parameterId: context.parameterId!,
                timePosition: context.timePosition!,
                value: context.value!,
              }),
          });
        }

        // Simplify action (only if enough points)
        if (
          context.selectedAutomationPoints?.length &&
          context.selectedAutomationPoints.length > 2
        ) {
          menuItems.push({
            eventType: 'simplify',
            displayName: 'Simplify',
            callback: () =>
              dispatchAction({
                type: 'simplify',
                automationPoints: context.selectedAutomationPoints!,
              }),
          });
        }
        break;
    }

    if (context.selectedAutomationPoints?.length || context.selectedMuteTransitions?.length) {
      // Delete Point action
      menuItems.push({
        eventType: 'delete',
        displayName: `Delete Selected`,
        callback: () =>
          dispatchAction({
            type: 'delete',
            automationPoints: context.selectedAutomationPoints,
            muteTransitions: context.selectedMuteTransitions,
          }),
      });
    }

    return menuItems;
  };

  const dispatchAction = async (action: GridAction) => {
    console.log('dispatchAction', action);
    switch (action.type) {
      case 'mergeClips':
        if (action.muteTransitions.length < 2) return;

        // Group by track
        const transitionsByTrack = action.muteTransitions.reduce(
          (acc, transition) => {
            if (!acc[transition.trackId]) acc[transition.trackId] = [];
            acc[transition.trackId].push(transition);
            return acc;
          },
          {} as Record<string, MuteTransition[]>,
        );

        // Merge clips for each track
        for (const [trackId, transitions] of Object.entries(transitionsByTrack)) {
          await trackDb
            .get()
            .muteTransitions.mergeMuteTransitionClips(transitions.map((t) => t.id));
        }
        break;

      case 'addClip':
        await trackDb
          .get()
          .muteTransitions.addMuteTransitionClip(action.trackId, action.timePosition);
        break;

      case 'delete':
        if (action.muteTransitions?.length) {
          await trackDb
            .get()
            .muteTransitions.deleteMuteTransitions(action.muteTransitions.map((t) => t.id));
        }
        if (action.automationPoints?.length) {
          await trackDb
            .get()
            .automation.deleteAutomationPoints(action.automationPoints.map((p) => p.id));
        }
        break;

      case 'addPoint':
        await trackDb
          .get()
          .automation.createAutomationPoint(action.parameterId, action.timePosition, action.value);
        break;

      case 'simplify':
        // TODO: Implement automation curve simplification algorithm
        // For now, this is a placeholder
        console.log('Simplify not yet implemented', action.automationPoints);
        break;
      default:
        assertNever(action);
    }
    await trackDb.refreshData();
    hideContextMenu();
  };

  return {
    getContextMenuState: () => contextMenuState,
    showContextMenu,
    hideContextMenu,
    dispatchAction,
    handleRightClick,
    handleDoubleClick,
  };
};

export const actionsDispatcher = getActionsDispatcher();

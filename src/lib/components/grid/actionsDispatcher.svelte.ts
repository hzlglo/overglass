import type { AutomationPoint, MuteTransition } from '$lib/database/schema';
import { trackDb } from '$lib/stores/trackDb.svelte';
import { MuteTransitionService } from '$lib/database/services/muteTransitionService';

// Action types and their required inputs
export type GridAction =
  | { type: 'mergeClips'; muteTransitions: MuteTransition[] }
  | { type: 'addClip'; trackId: string; timePosition: number }
  | { type: 'deleteClip'; muteTransitions: MuteTransition[] }
  | { type: 'deletePoint'; automationPoints: AutomationPoint[] }
  | { type: 'addPoint'; parameterId: string; timePosition: number; value: number }
  | { type: 'delete'; automationPoints?: AutomationPoint[]; muteTransitions?: MuteTransition[] }
  | { type: 'simplify'; automationPoints: AutomationPoint[] }
  | { type: 'deleteAll'; automationPoints?: AutomationPoint[]; muteTransitions?: MuteTransition[] };

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
          const allTrackTransitions = await trackDb
            .get()
            .muteTransitions.getMuteTransitionsForTrack(trackId);
          const mergedTransitions = MuteTransitionService.mergeSelectedTransitions(
            transitions,
            allTrackTransitions,
          );
          await trackDb.get().muteTransitions.updateMuteTransitions(mergedTransitions);
        }
        await trackDb.refreshData();
        break;

      case 'addClip':
        await trackDb
          .get()
          .muteTransitions.addMuteTransitionClip(action.trackId, action.timePosition);
        await trackDb.refreshData();
        break;

      case 'deleteClip':
        await trackDb
          .get()
          .muteTransitions.deleteMuteTransitions(action.muteTransitions.map((t) => t.id));
        await trackDb.refreshData();
        break;

      case 'deletePoint':
        await trackDb
          .get()
          .automation.deleteAutomationPoints(action.automationPoints.map((p) => p.id));
        await trackDb.refreshData();
        break;

      case 'addPoint':
        await trackDb
          .get()
          .automation.createAutomationPoint(action.parameterId, action.timePosition, action.value);
        await trackDb.refreshData();
        break;

      case 'delete':
        if (action.automationPoints?.length) {
          await trackDb
            .get()
            .automation.deleteAutomationPoints(action.automationPoints.map((p) => p.id));
        }
        if (action.muteTransitions?.length) {
          await trackDb
            .get()
            .muteTransitions.deleteMuteTransitions(action.muteTransitions.map((t) => t.id));
        }
        await trackDb.refreshData();
        break;

      case 'simplify':
        // TODO: Implement automation curve simplification algorithm
        // For now, this is a placeholder
        console.log('Simplify not yet implemented', action.automationPoints);
        break;

      case 'deleteAll':
        if (action.automationPoints?.length) {
          await trackDb
            .get()
            .automation.deleteAutomationPoints(action.automationPoints.map((p) => p.id));
        }
        if (action.muteTransitions?.length) {
          await trackDb
            .get()
            .muteTransitions.deleteMuteTransitions(action.muteTransitions.map((t) => t.id));
        }
        await trackDb.refreshData();
        break;
    }
    hideContextMenu();
  };

  // Event handlers that will be called from DOM event listeners
  const handleRightClick = (
    event: MouseEvent,
    elementType: 'track' | 'parameter' | 'brush',
    context: GridEventContext,
  ) => {
    event.preventDefault();

    const menuItems = createMenuItems(elementType, context);
    showContextMenu(event.clientX, event.clientY, menuItems);
  };

  const handleDoubleClick = (
    event: MouseEvent,
    elementType: 'track' | 'parameter' | 'automationPoint',
    context: GridEventContext,
  ) => {
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
            type: 'deletePoint',
            automationPoints: context.selectedAutomationPoints,
          });
        }
        break;
    }
  };

  const createMenuItems = (
    elementType: 'track' | 'parameter' | 'brush',
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
          // Delete Clip action
          menuItems.push({
            eventType: 'deleteClip',
            displayName: 'Delete Clip',
            callback: () =>
              dispatchAction({
                type: 'deleteClip',
                muteTransitions: context.selectedMuteTransitions!,
              }),
          });

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
            displayName: 'Add Point',
            callback: () =>
              dispatchAction({
                type: 'addPoint',
                parameterId: context.parameterId!,
                timePosition: context.timePosition!,
                value: context.value!,
              }),
          });
        }

        if (context.selectedAutomationPoints?.length) {
          // Delete Point action
          menuItems.push({
            eventType: 'deletePoint',
            displayName: 'Delete Point',
            callback: () =>
              dispatchAction({
                type: 'deletePoint',
                automationPoints: context.selectedAutomationPoints!,
              }),
          });

          // Simplify action (only if enough points)
          if (context.selectedAutomationPoints.length > 2) {
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
        }
        break;

      case 'brush':
        if (context.selectedAutomationPoints?.length || context.selectedMuteTransitions?.length) {
          // Delete All action
          menuItems.push({
            eventType: 'deleteAll',
            displayName: 'Delete All',
            callback: () =>
              dispatchAction({
                type: 'deleteAll',
                automationPoints: context.selectedAutomationPoints,
                muteTransitions: context.selectedMuteTransitions,
              }),
          });
        }

        if (
          context.selectedAutomationPoints?.length &&
          context.selectedAutomationPoints.length > 2
        ) {
          // Simplify action
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

    return menuItems;
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

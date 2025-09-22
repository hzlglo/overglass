import type { AutomationDatabase } from '$lib/database/duckdb';
import type { Parameter } from '$lib/database/schema';
import { fromPairs, get, sum } from 'lodash';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

export let TOP_TIMELINE_HEIGHT = 60;
export let BOTTOM_TIMELINE_HEIGHT = 60;

let DEFAULT_PARAMETER_HEIGHT = 100;
let DEFAULT_TRACK_HEIGHT = 50;
let DEFAULT_COLLAPSED_HEIGHT = 30;

export type LaneDisplay = { top: number; bottom: number; type: 'parameter' | 'track'; id: string };

export type TrackLaneState = {
  expanded: boolean;
};
export type ParameterLaneState = {
  expanded: boolean;
};

const getGridDisplayState = () => {
  // Reactive state for expansion
  let trackLaneStates = $state<SvelteMap<string, TrackLaneState>>(new SvelteMap());
  let parameterLaneStates = $state<SvelteMap<string, ParameterLaneState>>(new SvelteMap());
  let trackOrder = $state<string[]>([]);
  let parameterOrder = $state<SvelteMap<string, string[]>>(new SvelteMap());
  // store both track and parameter heights
  let laneHeights = $state<SvelteMap<string, number>>(new SvelteMap());
  let lanes: LaneDisplay[] = $derived.by(() => {
    let lanesInner: LaneDisplay[] = [];
    let y = 0;
    for (const trackId of trackOrder) {
      const trackLaneState = trackLaneStates.get(trackId);
      if (!trackLaneState) {
        continue;
      }
      lanesInner.push({
        top: y,
        bottom: y + (laneHeights.get(trackId) ?? 0),
        type: 'track',
        id: trackId,
      });
      y += laneHeights.get(trackId) ?? 0;
      if (trackLaneState.expanded) {
        const trackParameters = parameterOrder.get(trackId) ?? [];
        for (const parameterId of trackParameters) {
          lanesInner.push({
            top: y,
            bottom: y + (laneHeights.get(parameterId) ?? 0),
            type: 'parameter',
            id: parameterId,
          });
          y += laneHeights.get(parameterId) ?? 0;
        }
      }
    }
    return lanesInner;
  });

  async function syncWithDb(db: AutomationDatabase) {
    const tracks = await db.tracks.getAllTracks();
    // TODO make this sync logic more robust - we should merge tracks and params
    if (trackLaneStates.size === tracks.length) {
      console.log('syncWithDb: tracks already synced');
      return;
    }
    console.log('syncWithDb: resetting all track display state');
    if (tracks.length > 0) {
      trackOrder = tracks.map((t) => t.id);
      laneHeights = new SvelteMap(tracks.map((t) => [t.id, DEFAULT_TRACK_HEIGHT]));

      // Expand all parameters for each track
      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        const nonMuteParameters = parameters.filter((p) => !p.isMute);
        trackLaneStates.set(track.id, { expanded: true });
        if (nonMuteParameters) {
          nonMuteParameters.forEach((param) => {
            parameterLaneStates.set(param.id, { expanded: true });

            laneHeights.set(param.id, DEFAULT_PARAMETER_HEIGHT);
          });
        }
        parameterOrder.set(
          track.id,
          nonMuteParameters.map((p) => p.id),
        );
      }
    }
    console.log('syncWithDb finished', {
      trackLaneStates: $state.snapshot(trackLaneStates),
      parameterLaneStates: $state.snapshot(parameterLaneStates),
      trackOrder: $state.snapshot(trackOrder),
      parameterOrder: $state.snapshot(parameterOrder),
      laneHeights: $state.snapshot(laneHeights),
    });
  }

  function toggleTrackExpansion(trackId: string) {
    const trackLaneState = trackLaneStates.get(trackId);
    if (!trackLaneState) {
      return;
    }
    const newExpandedState = !trackLaneState.expanded;
    trackLaneStates.set(trackId, { ...trackLaneState, expanded: newExpandedState });

    if (newExpandedState) {
      laneHeights.set(trackId, DEFAULT_TRACK_HEIGHT);
    } else {
      laneHeights.set(trackId, DEFAULT_COLLAPSED_HEIGHT);
    }
  }

  function toggleParameterExpansion(parameterId: string) {
    const parameterLaneState = parameterLaneStates.get(parameterId);
    if (!parameterLaneState) {
      return;
    }
    const newExpandedState = !parameterLaneState.expanded;
    parameterLaneStates.set(parameterId, { ...parameterLaneState, expanded: newExpandedState });
    if (newExpandedState) {
      laneHeights.set(parameterId, DEFAULT_PARAMETER_HEIGHT);
    } else {
      laneHeights.set(parameterId, DEFAULT_COLLAPSED_HEIGHT);
    }
  }

  let isSyncingScroll = $state(false);
  let gridContainer = $state<HTMLDivElement>();
  let trackListContainer = $state<HTMLDivElement>();
  function syncScroll(source: HTMLDivElement, target: HTMLDivElement) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    target.scrollTop = source.scrollTop;
    isSyncingScroll = false;
  }

  return {
    syncWithDb,
    getTrackExpanded: (trackId: string) => trackLaneStates.get(trackId)?.expanded ?? false,
    getParameterExpanded: (parameterId: string) =>
      parameterLaneStates.get(parameterId)?.expanded ?? false,
    toggleTrackExpansion,
    toggleParameterExpansion,
    getTrackOrder: () => trackOrder,
    getParameterOrder: () => parameterOrder,
    setTrackOrder: (order: string[]) => {
      trackOrder = order;
    },
    setParameterOrder: (trackId: string, order: string[]) => {
      parameterOrder.set(trackId, order);
    },
    getLaneHeight: (trackOrParamId: string) => laneHeights.get(trackOrParamId) ?? 0,
    getGridHeight: () => sum(Array.from(laneHeights.values())),
    getLanes: () => lanes,
    setLaneHeight: (trackOrParamId: string, height: number) => {
      laneHeights.set(trackOrParamId, height);
    },
    setGridContainer: (container: HTMLDivElement) => {
      gridContainer = container;
    },
    getGridContainer: () => gridContainer,
    setTrackListContainer: (container: HTMLDivElement) => {
      trackListContainer = container;
    },
    getTrackListContainer: () => trackListContainer,
    syncScroll,
  };
};

export const gridDisplayState = getGridDisplayState();

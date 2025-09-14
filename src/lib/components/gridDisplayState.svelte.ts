import type { AutomationDatabase } from '$lib/database/duckdb';
import { fromPairs, get, sum } from 'lodash';
import { SvelteSet } from 'svelte/reactivity';

export let TOP_TIMELINE_HEIGHT = 60;
export let BOTTOM_TIMELINE_HEIGHT = 60;

let DEFAULT_PARAMETER_HEIGHT = 150;
let DEFAULT_TRACK_HEIGHT = 50;
let DEFAULT_COLLAPSED_HEIGHT = 30;

const getGridDisplayState = () => {
  // Reactive state for expansion
  let expandedTracks = $state<SvelteSet<string>>(new SvelteSet());
  let expandedParameters = $state<SvelteSet<string>>(new SvelteSet());
  let trackOrder = $state<string[]>([]);
  let parameterOrder = $state<{ [trackId: string]: string[] }>({});
  // store both track and parameter heights
  let laneHeights = $state<{ [laneId: string]: number }>({});
  let { laneYPositions, laneBoundaries } = $derived.by(() => {
    let yPositions: { [trackOrParamId: string]: number } = {};
    let laneBoundaries: number[] = [0];
    let y = 0;
    for (const trackId of trackOrder) {
      yPositions[trackId] = y;
      y += laneHeights[trackId];
      laneBoundaries.push(y);
      if (expandedTracks.has(trackId)) {
        for (const parameterId of get(parameterOrder, trackId, [])) {
          yPositions[parameterId] = y;
          y += laneHeights[parameterId];
          laneBoundaries.push(y);
        }
      }
    }
    return { laneYPositions: yPositions, laneBoundaries };
  });

  async function initFromDb(db: AutomationDatabase) {
    const tracks = await db.tracks.getAllTracks();
    if (tracks.length > 0) {
      // Expand all tracks
      expandedTracks = new SvelteSet(tracks.map((t) => t.id));
      trackOrder = tracks.map((t) => t.id);
      laneHeights = fromPairs(tracks.map((t) => [t.id, DEFAULT_TRACK_HEIGHT]));

      // Expand all parameters for each track
      const allParameterIds = new Set<string>();
      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        if (parameters) {
          parameters.forEach((param) => {
            allParameterIds.add(param.id);

            laneHeights = { ...$state.snapshot(laneHeights), [param.id]: DEFAULT_PARAMETER_HEIGHT };
          });
        }
        console.log('parameters', track, parameters);
        parameterOrder = {
          ...$state.snapshot(parameterOrder),
          [track.id]: parameters.map((p) => p.id),
        };
      }
      expandedParameters = new SvelteSet(allParameterIds);
    }
    console.log('init grid display state', {
      expandedTracks,
      expandedParameters,
      trackOrder,
      parameterOrder,
      laneHeights,
    });
  }

  function toggleTrackExpansion(trackId: string) {
    if (expandedTracks.has(trackId)) {
      expandedTracks.delete(trackId);
      laneHeights[trackId] = DEFAULT_COLLAPSED_HEIGHT;
    } else {
      expandedTracks.add(trackId);
      laneHeights[trackId] = DEFAULT_TRACK_HEIGHT;
    }
  }

  function toggleParameterExpansion(parameterId: string) {
    if (expandedParameters.has(parameterId)) {
      expandedParameters.delete(parameterId);
      laneHeights[parameterId] = DEFAULT_COLLAPSED_HEIGHT;
    } else {
      expandedParameters.add(parameterId);
      laneHeights[parameterId] = DEFAULT_PARAMETER_HEIGHT;
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
    initFromDb,
    getTrackExpanded: (trackId: string) => expandedTracks.has(trackId),
    getParameterExpanded: (parameterId: string) => expandedParameters.has(parameterId),
    toggleTrackExpansion,
    toggleParameterExpansion,
    getTrackOrder: () => trackOrder,
    getParameterOrder: () => parameterOrder,
    setTrackOrder: (order: string[]) => {
      trackOrder = order;
    },
    setParameterOrder: (trackId: string, order: string[]) => {
      parameterOrder[trackId] = order;
    },
    getLaneHeight: (trackOrParamId: string) => laneHeights[trackOrParamId],
    getGridHeight: () => sum(Object.values(laneHeights)),
    getLaneYPositions: () => laneYPositions,
    getLaneBoundaries: () => laneBoundaries,
    setLaneHeight: (trackOrParamId: string, height: number) => {
      laneHeights[trackOrParamId] = height;
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

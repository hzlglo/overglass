import type { AutomationDatabase } from '$lib/database/duckdb';
import type { Device, Parameter, Track } from '$lib/database/schema';
import { appConfigStore } from '$lib/stores/customization.svelte';
import { compact, sum } from 'lodash';
import { SvelteMap } from 'svelte/reactivity';

export let TOP_TIMELINE_HEIGHT = 60;
export let BOTTOM_TIMELINE_HEIGHT = 60;

let DEFAULT_PARAMETER_HEIGHT = 60;
let DEFAULT_TRACK_HEIGHT = 50;
let DEFAULT_COLLAPSED_HEIGHT = 25;

export type TrackLaneState = {
  expanded: boolean;
  track: Track;
  device: Device;
};
export type ParameterLaneState = {
  name: string;
  expanded: boolean;
  track: Track;
  device: Device;
  parameter: Parameter;
};

export type TrackLaneDisplay = TrackLaneState & {
  top: number;
  bottom: number;
  height: number;
  type: 'track';
  id: string;
};
export type ParameterLaneDisplay = ParameterLaneState & {
  top: number;
  bottom: number;
  height: number;
  type: 'parameter';
  id: string;
};
export type LaneDisplay = TrackLaneDisplay | ParameterLaneDisplay;

// the lanes to display for a track, taking into account search-filtering and sorting within the track
export type TrackLanesDisplay = {
  trackId: string;
  // null if the track is filtered out by search
  trackLane: TrackLaneDisplay | null;
  parameterLanes: ParameterLaneDisplay[];
};

const getSharedGridState = () => {
  // Reactive state for expansion
  let trackLaneStates = $state<Record<string, TrackLaneState>>({});
  let parameterLaneStates = $state<Record<string, ParameterLaneState>>({});
  let trackOrder = $state<string[]>([]);
  let parameterOrder = $state<Record<string, string[]>>({});
  // store both track and parameter heights
  let laneHeights = $state<Record<string, number>>({});
  let laneSearch = $state<string>('');
  let { lanes, lanesByTrack }: { lanes: LaneDisplay[]; lanesByTrack: TrackLanesDisplay[] } =
    $derived.by(() => {
      let lanesInner: LaneDisplay[] = [];
      let lanesByTrackInner: TrackLanesDisplay[] = [];
      let y = 0;
      const customizations = appConfigStore.get();
      for (const trackId of trackOrder) {
        const trackLaneState = trackLaneStates[trackId];
        if (!trackLaneState) {
          continue;
        }
        const trackNames = compact([
          customizations?.trackCustomizations[trackId]?.userEnteredName,
          customizations?.trackCustomizations[trackId]?.rawTrackName,
        ]);
        let trackLanesDisplay: TrackLanesDisplay = {
          trackId,
          trackLane: null,
          parameterLanes: [],
        };
        let trackMatchesSearch =
          laneSearch === '' ||
          trackNames.some((name) => name.toLowerCase().includes(laneSearch.toLowerCase()));
        if (trackMatchesSearch) {
          const height = laneHeights[trackId] ?? 0;
          const trackLane: TrackLaneDisplay = {
            top: y,
            bottom: y + height,
            height,
            type: 'track',
            id: trackId,
            ...trackLaneState,
          };
          lanesInner.push(trackLane);
          trackLanesDisplay.trackLane = trackLane;
          y += laneHeights[trackId] ?? 0;
        }
        if (trackLaneState.expanded) {
          const trackParameters = parameterOrder[trackId] ?? [];
          for (const parameterId of trackParameters) {
            const parameterLaneState = parameterLaneStates[parameterId];
            if (!parameterLaneState) {
              continue;
            }
            let parameterMatchesSearch =
              laneSearch === '' ||
              parameterLaneState.name.toLowerCase().includes(laneSearch.toLowerCase());
            if (parameterMatchesSearch || trackMatchesSearch) {
              const height = laneHeights[parameterId] ?? 0;
              const parameterLane: ParameterLaneDisplay = {
                top: y,
                bottom: y + height,
                height,
                type: 'parameter',
                id: parameterId,
                ...parameterLaneState,
              };
              lanesInner.push(parameterLane);
              trackLanesDisplay.parameterLanes.push(parameterLane);
              y += laneHeights[parameterId] ?? 0;
            }
          }
        }
        lanesByTrackInner.push(trackLanesDisplay);
      }
      console.log('sharedGridState: lanes', {
        lanes: lanesInner,
        lanesByTrack: lanesByTrackInner,
      });
      return { lanes: lanesInner, lanesByTrack: lanesByTrackInner };
    });

  async function syncWithDb(db: AutomationDatabase) {
    const tracks = await db.tracks.getAllTracks();
    console.log('syncWithDb', {
      trackLaneStates: $state.snapshot(trackLaneStates),
      tracks,
    });
    if (tracks.length > 0) {
      // Expand all parameters for each track
      for (const track of tracks) {
        if (!trackOrder.includes(track.id)) {
          trackOrder.push(track.id);
        }
        if (!laneHeights[track.id]) {
          laneHeights[track.id] = DEFAULT_TRACK_HEIGHT;
        }
        const [device, parameters] = await Promise.all([
          db.devices.getDeviceById(track.deviceId),
          db.tracks.getParametersForTrack(track.id),
        ]);
        const nonMuteParameters = parameters.filter((p) => !p.isMute);
        if (!trackLaneStates[track.id]) {
          trackLaneStates[track.id] = { expanded: true, track, device };
        }
        if (nonMuteParameters) {
          nonMuteParameters.forEach((param) => {
            if (!parameterLaneStates[param.id]) {
              parameterLaneStates[param.id] = {
                expanded: true,
                name: param.parameterName,
                track,
                device: device,
                parameter: param,
              };
            }
            if (!laneHeights[param.id]) {
              laneHeights[param.id] = DEFAULT_PARAMETER_HEIGHT;
            }
          });
        }
        if (!parameterOrder[track.id]) {
          parameterOrder[track.id] = nonMuteParameters.map((p) => p.id);
        } else {
          nonMuteParameters.forEach((param) => {
            if (!parameterOrder[track.id]?.includes(param.id)) {
              parameterOrder[track.id]?.push(param.id);
            }
          });
        }
      }
    }
  }

  function toggleTrackExpansion(trackId: string) {
    const trackLaneState = trackLaneStates[trackId];
    if (!trackLaneState) {
      return;
    }
    const newExpandedState = !trackLaneState.expanded;
    trackLaneStates[trackId] = { ...trackLaneState, expanded: newExpandedState };

    if (newExpandedState) {
      laneHeights[trackId] = DEFAULT_TRACK_HEIGHT;
    } else {
      laneHeights[trackId] = DEFAULT_COLLAPSED_HEIGHT;
    }
  }

  function toggleParameterExpansion(parameterId: string) {
    const parameterLaneState = parameterLaneStates[parameterId];
    if (!parameterLaneState) {
      return;
    }
    const newExpandedState = !parameterLaneState.expanded;
    parameterLaneStates[parameterId] = { ...parameterLaneState, expanded: newExpandedState };
    if (newExpandedState) {
      laneHeights[parameterId] = DEFAULT_PARAMETER_HEIGHT;
    } else {
      laneHeights[parameterId] = DEFAULT_COLLAPSED_HEIGHT;
    }
  }

  return {
    setLaneSearch: (search: string) => {
      laneSearch = search;
    },
    getLaneSearch: () => laneSearch,
    syncWithDb,
    getTrackState: (trackId: string) => trackLaneStates[trackId],
    getParameterState: (parameterId: string) => parameterLaneStates[parameterId],
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
    getLaneHeight: (trackOrParamId: string) => laneHeights[trackOrParamId] ?? 0,
    getGridHeight: () => sum(lanes.map((l) => l.height)),
    getLanes: () => lanes,
    getLanesByTrack: () => lanesByTrack,
    setLaneHeight: (trackOrParamId: string, height: number) => {
      laneHeights[trackOrParamId] = height;
    },
  };
};

export const sharedGridState = getSharedGridState();

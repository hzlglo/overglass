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
  let trackLaneStates = $state<SvelteMap<string, TrackLaneState>>(new SvelteMap());
  let parameterLaneStates = $state<SvelteMap<string, ParameterLaneState>>(new SvelteMap());
  let trackOrder = $state<string[]>([]);
  let parameterOrder = $state<SvelteMap<string, string[]>>(new SvelteMap());
  // store both track and parameter heights
  let laneHeights = $state<SvelteMap<string, number>>(new SvelteMap());
  let laneSearch = $state<string>('');
  let { lanes, lanesByTrack }: { lanes: LaneDisplay[]; lanesByTrack: TrackLanesDisplay[] } =
    $derived.by(() => {
      let lanesInner: LaneDisplay[] = [];
      let lanesByTrackInner: TrackLanesDisplay[] = [];
      let y = 0;
      const customizations = appConfigStore.get();
      for (const trackId of trackOrder) {
        const trackLaneState = trackLaneStates.get(trackId);
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
          const height = laneHeights.get(trackId) ?? 0;
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
          y += laneHeights.get(trackId) ?? 0;
        }
        if (trackLaneState.expanded) {
          const trackParameters = parameterOrder.get(trackId) ?? [];
          for (const parameterId of trackParameters) {
            const parameterLaneState = parameterLaneStates.get(parameterId);
            if (!parameterLaneState) {
              continue;
            }
            let parameterMatchesSearch =
              laneSearch === '' ||
              parameterLaneState.name.toLowerCase().includes(laneSearch.toLowerCase());
            if (parameterMatchesSearch || trackMatchesSearch) {
              const height = laneHeights.get(parameterId) ?? 0;
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
              y += laneHeights.get(parameterId) ?? 0;
            }
          }
        }
        lanesByTrackInner.push(trackLanesDisplay);
      }
      console.log('sharedGridState', { lanesByTrackInner, lanesInner });
      return { lanes: lanesInner, lanesByTrack: lanesByTrackInner };
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
        const [device, parameters] = await Promise.all([
          db.devices.getDeviceById(track.deviceId),
          db.tracks.getParametersForTrack(track.id),
        ]);
        const nonMuteParameters = parameters.filter((p) => !p.isMute);
        trackLaneStates.set(track.id, { expanded: true, track, device });
        if (nonMuteParameters) {
          nonMuteParameters.forEach((param) => {
            parameterLaneStates.set(param.id, {
              expanded: true,
              name: param.parameterName,
              track,
              device: device,
              parameter: param,
            });

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

  return {
    setLaneSearch: (search: string) => {
      laneSearch = search;
    },
    getLaneSearch: () => laneSearch,
    syncWithDb,
    getTrackState: (trackId: string) => trackLaneStates.get(trackId),
    getParameterState: (parameterId: string) => parameterLaneStates.get(parameterId),
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
    getGridHeight: () => sum(lanes.map((l) => l.height)),
    getLanes: () => lanes,
    getLanesByTrack: () => lanesByTrack,
    setLaneHeight: (trackOrParamId: string, height: number) => {
      laneHeights.set(trackOrParamId, height);
    },
  };
};

export const sharedGridState = getSharedGridState();

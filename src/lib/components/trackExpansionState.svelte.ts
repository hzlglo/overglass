import type { AutomationDatabase } from '$lib/database/duckdb';
import { SvelteSet } from 'svelte/reactivity';

const getTrackExpansionState = () => {
  // Reactive state for expansion
  let expandedTracks = $state<SvelteSet<string>>(new SvelteSet());
  let expandedParameters = $state<SvelteSet<string>>(new SvelteSet());

  async function initFromDb(db: AutomationDatabase) {
    const tracks = await db.tracks.getAllTracks();
    if (tracks.length > 0) {
      // Expand all tracks
      expandedTracks = new SvelteSet(tracks.map((t) => t.id));

      // Expand all parameters for each track
      const allParameterIds = new Set<string>();
      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        if (parameters) {
          parameters.forEach((param) => allParameterIds.add(param.id));
        }
      }
      expandedParameters = new SvelteSet(allParameterIds);
    }
  }

  function toggleTrackExpansion(trackId: string) {
    if (expandedTracks.has(trackId)) {
      expandedTracks.delete(trackId);
    } else {
      expandedTracks.add(trackId);
    }
  }

  function toggleParameterExpansion(parameterId: string) {
    if (expandedParameters.has(parameterId)) {
      expandedParameters.delete(parameterId);
    } else {
      expandedParameters.add(parameterId);
    }
  }

  return {
    initFromDb,
    getTrackExpanded: (trackId: string) => expandedTracks.has(trackId),
    getParameterExpanded: (parameterId: string) => expandedParameters.has(parameterId),
    toggleTrackExpansion,
    toggleParameterExpansion,
  };
};

export const trackExpansionState = getTrackExpansionState();

<script lang="ts">
  import { automationDb } from '../stores/database.svelte';
  import AutomationParameter from './AutomationParameter.svelte';

  interface DeviceTrackProps {
    device: {
      id: string;
      deviceName: string;
      deviceType: string;
      trackCount: number;
      parameterCount: number;
      automationPointCount: number;
    };
    isDeviceExpanded: boolean;
    expandedTracks: Set<string>;
    onToggleDevice: () => void;
    onToggleTrack: (trackId: string) => void;
  }

  let {
    device,
    isDeviceExpanded,
    expandedTracks,
    onToggleDevice,
    onToggleTrack,
  }: DeviceTrackProps = $props();

  // State for parameter expansion
  let expandedParameters = $state<Set<string>>(new Set());

  function toggleParameterExpansion(parameterId: string) {
    if (expandedParameters.has(parameterId)) {
      expandedParameters.delete(parameterId);
      expandedParameters = new Set(expandedParameters);
    } else {
      expandedParameters.add(parameterId);
      expandedParameters = new Set(expandedParameters);
    }
  }

  // Reactive queries
  let tracks = $derived(
    isDeviceExpanded
      ? automationDb.get().devices.getTracksForDevice(device.id)
      : Promise.resolve([]),
  );

  function getTrackParameters(trackId: string) {
    return expandedTracks.has(trackId)
      ? automationDb.get().devices.getParametersForTrack(trackId)
      : Promise.resolve([]);
  }

  // Expand all parameters by default when tracks are expanded
  $effect(() => {
    if (tracks && expandedTracks.size > 0) {
      tracks.then(async trackList => {
        const allParameterIds = new Set<string>();
        const db = automationDb.get();
        if (db) {
          for (const track of trackList) {
            if (expandedTracks.has(track.id)) {
              const parameters = await db.devices.getParametersForTrack(track.id);
              if (parameters) {
                parameters.forEach(param => allParameterIds.add(param.id));
              }
            }
          }
          expandedParameters = allParameterIds;
        }
      });
    }
  });
</script>

<div class="card bg-base-100 border-base-300 border shadow-sm">
  <div class="card-body p-4">
    <!-- Device Header -->
    <div
      class="hover:bg-base-200 -m-2 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors"
      onclick={onToggleDevice}
    >
      <div class="flex items-center gap-3">
        <div class="text-lg">
          {isDeviceExpanded ? '▼' : '▶'}
        </div>
        <div class="badge badge-primary badge-lg">{device.device_name}</div>
      </div>
      <div class="text-base-content/60 font-mono text-sm">
        {device.trackCount} tracks • {device.parameterCount} parameters • {device.automationPointCount}
        points
      </div>
    </div>

    <!-- Expanded Device Content (Tracks) -->
    {#if isDeviceExpanded}
      {#await tracks}
        <div class="text-base-content/60 mt-4 ml-6 flex items-center gap-2">
          <div class="loading loading-spinner loading-sm"></div>
          Loading tracks...
        </div>
      {:then trackList}
        {$inspect('trackList', trackList)}
        <div class="mt-4 ml-6 space-y-3">
          {#each trackList as track}
            {$inspect(track)}
            <div class="border-base-300 border-l-2 pl-4">
              <!-- Track Header -->
              <div
                class="hover:bg-base-200 -ml-2 flex cursor-pointer items-center justify-between rounded py-1 pr-2 pl-2 transition-colors"
                onclick={() => onToggleTrack(track.id)}
              >
                <div class="flex items-center gap-3">
                  <div class="text-sm">
                    {expandedTracks.has(track.id) ? '▼' : '▶'}
                  </div>
                  <div class="font-medium">
                    Track {track.trackNumber}
                    {#if track.isMuted}
                      <div class="badge badge-outline badge-sm ml-2">Muted</div>
                    {/if}
                  </div>
                </div>
                <div class="text-base-content/60 font-mono text-xs">
                  {track.parameterCount} params • {track.automationPointCount} points
                  {#if track.last_edit_time}
                    • edited {new Date(track.last_edit_time).toLocaleTimeString()}
                  {/if}
                </div>
              </div>

              <!-- Expanded Track Parameters -->
              {#if expandedTracks.has(track.id)}
                {#await getTrackParameters(track.id)}
                  <div class="text-base-content/60 mt-2 ml-6 flex items-center gap-2 text-sm">
                    <div class="loading loading-spinner loading-sm"></div>
                    Loading parameters...
                  </div>
                {:then parameterList}
                  <div class="mt-2 ml-6 space-y-2">
                    {#each parameterList as param}
                      <AutomationParameter
                        parameter={param}
                        isExpanded={expandedParameters.has(param.id)}
                        onToggle={() => toggleParameterExpansion(param.id)}
                      />
                    {/each}
                  </div>
                {:catch error}
                  <div class="text-error mt-2 ml-6 text-sm">
                    Error loading parameters: {error.message}
                  </div>
                {/await}
              {/if}
            </div>
          {/each}
        </div>
      {:catch error}
        <div class="text-error mt-4 ml-6">
          Error loading tracks: {error.message}
        </div>
      {/await}
    {/if}
  </div>
</div>

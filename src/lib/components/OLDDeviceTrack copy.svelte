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
      tracks.then(async (trackList) => {
        const allParameterIds = new Set<string>();
        const db = automationDb.get();
        if (db) {
          for (const track of trackList) {
            if (expandedTracks.has(track.id)) {
              const parameters = await db.devices.getParametersForTrack(track.id);
              if (parameters) {
                parameters.forEach((param) => allParameterIds.add(param.id));
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
  <div class="card-body p-0">
    {#if isDeviceExpanded}
      <!-- Grid Layout: Charts Left, Info Right -->
      <div class="grid min-h-0 grid-cols-3">
        <!-- Left Panel: Automation Charts (2/3 width) -->
        <div class="border-base-300 col-span-2 border-r">
          {#await tracks}
            <div class="flex h-32 items-center justify-center">
              <div class="loading loading-spinner loading-sm"></div>
              <span class="ml-2">Loading tracks...</span>
            </div>
          {:then trackList}
            <!-- Continuous chart area with no gaps or dividers -->
            <div>
              {#each trackList as track}
                {#if expandedTracks.has(track.id)}
                  {#await getTrackParameters(track.id)}
                    <div class="flex h-32 items-center justify-center">
                      <div class="loading loading-spinner loading-sm"></div>
                      <span class="ml-2">Loading parameters...</span>
                    </div>
                  {:then parameterList}
                    {#each parameterList as param}
                      {#if expandedParameters.has(param.id)}
                        <AutomationParameter
                          parameter={param}
                          isExpanded={expandedParameters.has(param.id)}
                          onToggle={() => toggleParameterExpansion(param.id)}
                        />
                      {/if}
                    {/each}
                  {:catch error}
                    <div class="text-error p-4 text-sm">
                      Error loading parameters: {error.message}
                    </div>
                  {/await}
                {/if}
              {/each}
            </div>
          {:catch error}
            <div class="text-error p-4">
              Error loading tracks: {error.message}
            </div>
          {/await}
        </div>

        <!-- Right Panel: Device & Track Info (1/3 width) -->
        <div class="bg-base-50 col-span-1">
          <!-- Device Header (fixed height) -->
          <div class="border-base-300 border-b p-4">
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
            </div>
            <div class="text-base-content/60 mt-2 font-mono text-xs">
              {device.trackCount} tracks • {device.parameterCount} parameters • {device.automationPointCount}
              points
            </div>
          </div>

          <!-- Track Information aligned with charts -->
          {#await tracks}
            <div class="text-base-content/60 flex items-center gap-2 p-4">
              <div class="loading loading-spinner loading-sm"></div>
              Loading tracks...
            </div>
          {:then trackList}
            <div>
              {#each trackList as track}
                {#if expandedTracks.has(track.id)}
                  {#await getTrackParameters(track.id)}
                    <div class="flex h-32 items-center justify-center p-4">
                      <div class="loading loading-spinner loading-sm"></div>
                      <span class="ml-2">Loading parameters...</span>
                    </div>
                  {:then parameterList}
                    <!-- Track section with height matching its parameters -->
                    <div
                      class="border-base-300 border-b p-4"
                      style="min-height: {parameterList.filter((p) => expandedParameters.has(p.id))
                        .length * 200}px;"
                    >
                      <!-- Track Header -->
                      <div class="mb-3">
                        <div
                          class="hover:bg-base-200 cursor-pointer rounded p-2 transition-colors"
                          onclick={() => onToggleTrack(track.id)}
                        >
                          <div class="flex items-center gap-2 text-sm font-medium">
                            <div class="text-xs">
                              {expandedTracks.has(track.id) ? '▼' : '▶'}
                            </div>
                            Track {track.trackNumber}
                            {#if track.isMuted}
                              <div class="badge badge-outline badge-xs">Muted</div>
                            {/if}
                          </div>
                          <div class="text-base-content/60 mt-1 text-xs">
                            {track.parameterCount} params • {track.automationPointCount} points
                          </div>
                        </div>
                      </div>

                      <!-- Parameters aligned with their charts -->
                      <div class="space-y-2">
                        {#each parameterList as param}
                          {#if expandedParameters.has(param.id)}
                            <div
                              class="bg-base-100 border-base-300 cursor-pointer rounded border p-3 text-xs transition-colors"
                              class:bg-primary={expandedParameters.has(param.id)}
                              class:bg-opacity-10={expandedParameters.has(param.id)}
                              onclick={() => toggleParameterExpansion(param.id)}
                              style="height: 180px; display: flex; flex-direction: column; justify-content: center;"
                            >
                              <div class="mb-2 font-medium">
                                {param.parameterName || `Param ${param.id.split('_').pop()}`}
                              </div>
                              <div class="text-base-content/60">
                                {param.pointCount} points
                              </div>
                              <div class="text-base-content/60">
                                Range: {param.minValue?.toFixed(2)} - {param.maxValue?.toFixed(2)}
                              </div>
                            </div>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {:catch error}
                    <div class="text-error p-4 text-sm">
                      Error loading parameters: {error.message}
                    </div>
                  {/await}
                {/if}
              {/each}
            </div>
          {:catch error}
            <div class="text-error p-4">
              Error loading tracks: {error.message}
            </div>
          {/await}
        </div>
      </div>
    {:else}
      <!-- Collapsed Device Header -->
      <div class="p-4">
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
      </div>
    {/if}
  </div>
</div>

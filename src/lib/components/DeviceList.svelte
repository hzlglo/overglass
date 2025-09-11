<script lang="ts">
  import { automationDb } from '../stores/database.svelte';
  import DeviceTrack from './DeviceTrack.svelte';

  // Reactive state for expansion
  let expandedDevices = $state<Set<string>>(new Set());
  let expandedTracks = $state<Set<string>>(new Set());

  // Reactive database queries
  let databaseDevices = $derived(automationDb.getDevices());
  let isRecalculating = $derived(automationDb.isRecalculating());

  function toggleDeviceExpansion(deviceId: string) {
    if (expandedDevices.has(deviceId)) {
      expandedDevices.delete(deviceId);
      expandedDevices = new Set(expandedDevices);
    } else {
      expandedDevices.add(deviceId);
      expandedDevices = new Set(expandedDevices);
    }
  }

  function toggleTrackExpansion(trackId: string) {
    if (expandedTracks.has(trackId)) {
      expandedTracks.delete(trackId);
      expandedTracks = new Set(expandedTracks);
    } else {
      expandedTracks.add(trackId);
      expandedTracks = new Set(expandedTracks);
    }
  }
</script>

{#await databaseDevices}
  <div class="flex items-center gap-3 p-4">
    <div class="loading loading-spinner loading-sm"></div>
    Loading devices...
  </div>
{:then devices}
  {#if devices.length > 0}
    <!-- Database-powered hierarchical view -->
    <div class="mb-6">
      <div class="mb-3 flex items-center gap-3">
        <h3 class="text-lg font-semibold">🎛️ Elektron Device Automation</h3>
        {#if isRecalculating}
          <div class="loading loading-spinner loading-sm"></div>
        {/if}
      </div>

      <div class="space-y-4">
        {#each devices as device}
          <DeviceTrack
            {device}
            isDeviceExpanded={expandedDevices.has(device.device_id)}
            {expandedTracks}
            onToggleDevice={() => toggleDeviceExpansion(device.device_id)}
            onToggleTrack={toggleTrackExpansion}
          />
        {/each}
      </div>
    </div>
  {:else}
    <div class="text-base-content/60 py-8 text-center">
      No Elektron devices found in the database
    </div>
  {/if}
{:catch error}
  <div class="text-error p-4">
    Error loading devices: {error.message}
  </div>
{/await}

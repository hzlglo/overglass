<script lang="ts">
  import { automationDb } from '../stores/database.svelte';
  import Track from './Track.svelte';
  import { trackExpansionState } from './trackExpansionState.svelte';

  // Reactive database queries
  let tracksPromise = $derived(automationDb.get().tracks.getAllTracks());
  let isRecalculating = $derived(automationDb.isRecalculating());

  $effect(() => {
    trackExpansionState.initFromDb(automationDb.get());
  });
</script>

{#await tracksPromise}
  <div class="flex items-center gap-3 p-4">
    <div class="loading loading-spinner loading-sm"></div>
    Loading devices...
  </div>
{:then tracks}
  {$inspect('here tracks', tracks)}
  {#if tracks.length > 0}
    <!-- Database-powered hierarchical view -->
    <div class="mb-6">
      <div class="mb-3 flex items-center gap-3">
        {#if isRecalculating}
          <div class="loading loading-spinner loading-sm"></div>
        {/if}
      </div>

      <div class="space-y-4">
        {#each tracks as track}
          <Track {track} />
        {/each}
      </div>
    </div>
  {:else}
    <div class="text-base-content/60 py-8 text-center">No devices found</div>
  {/if}
{:catch error}
  <div class="text-error p-4">
    Error loading devices: {error.message}
  </div>
{/await}

<script lang="ts">
  import TrackList from '../tracklist/TrackList.svelte';
  import Grid from './Grid.svelte';
  import { sharedGridState } from './sharedGridState.svelte';
  import { trackDb } from '../../stores/trackDb.svelte';

  let isInitialized = $derived(trackDb.isInitialized());

  $effect(() => {
    if (!isInitialized) {
      return;
    }
    console.log('GridAndTrackList: syncWithDb');
    sharedGridState.syncWithDb(trackDb.get());
  });

  let gridScroll = $state(0);
</script>

<div class="flex min-h-0 flex-1 flex-row px-3">
  {#if isInitialized}
    <Grid bind:gridScroll />
    <TrackList bind:gridScroll />
  {:else}
    <div class="text-error">Database not initialized</div>
  {/if}
</div>

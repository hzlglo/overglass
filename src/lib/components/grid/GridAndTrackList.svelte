<script lang="ts">
  import TrackList from '../tracklist/TrackList.svelte';
  import Grid from './Grid.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import { trackDb } from '../../stores/trackDb.svelte';

  let isInitialized = $derived(trackDb.isInitialized());

  $effect(() => {
    if (!isInitialized) {
      return;
    }
    console.log('GridAndTrackList: syncWithDb');
    gridDisplayState.syncWithDb(trackDb.get());
  });
</script>

<div class="flex min-h-0 flex-row">
  {#if isInitialized}
    <Grid />
    <TrackList />
  {:else}
    <div class="text-error">Database not initialized</div>
  {/if}
</div>

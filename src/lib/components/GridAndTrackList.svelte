<script lang="ts">
  import TrackList from './TrackList.svelte';
  import Grid from './Grid.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import { automationDb } from '../stores/database.svelte';

  let isInitialized = $derived(automationDb.isInitialized());

  $effect(() => {
    if (!isInitialized) {
      return;
    }
    gridDisplayState.initFromDb(automationDb.get());
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

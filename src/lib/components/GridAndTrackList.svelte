<script lang="ts">
  import TrackList from './TrackList.svelte';
  import Grid from './Grid.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import { automationDb } from '../stores/database.svelte';

  $effect(() => {
    gridDisplayState.initFromDb(automationDb.get());
  });
</script>

<div class="flex min-h-0 flex-row">
  <Grid />
  <TrackList />
</div>

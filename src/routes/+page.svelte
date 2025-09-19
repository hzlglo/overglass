<script lang="ts">
  import FileChooser from '$lib/components/app/FileChooser.svelte';
  import PageWrapper from '$lib/components/app/PageWrapper.svelte';
  import GridAndTrackList from '$lib/components/grid/GridAndTrackList.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import '../app.css';
</script>

<PageWrapper hideNavbar={appStore.currentScreen === 'file-chooser'}>
  {#if appStore.currentScreen === 'file-chooser'}
    <FileChooser />
  {:else}
    <GridAndTrackList />
  {/if}
</PageWrapper>

<script lang="ts">
  import { goto } from '$app/navigation';
  import FileChooser from '$lib/components/app/FileChooser.svelte';
  import PageWrapper from '$lib/components/app/PageWrapper.svelte';
  import GridAndTrackList from '$lib/components/grid/GridAndTrackList.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import { ArrowLeftIcon } from '@lucide/svelte';
  import '../app.css';
</script>

<PageWrapper hideNavbar={appStore.getLoadedFile() == null}>
  {#snippet navbarBackAction()}
    <button
      class="btn btn-ghost btn-sm"
      onclick={() => {
        appStore.resetApp();
        trackDb.destroy();
        goto('/');
      }}
    >
      <ArrowLeftIcon />
      Load a different file
    </button>
  {/snippet}
  {#if appStore.getLoadedFile() == null}
    <FileChooser />
  {:else}
    <GridAndTrackList />
  {/if}
</PageWrapper>

<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { ArrowLeftIcon, ArrowRightIcon } from '@lucide/svelte';
  import { fromPairs, toPairs } from 'lodash';
  import { ALSParser } from '../../parsers/alsParser';
  import { appStore } from '../../stores/app.svelte';
  import { trackDb } from '../../stores/trackDb.svelte';

  let selectedFile = $state<File | null>(null);
  let fileName = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  const DEVELOPMENT = false;

  const parser = new ALSParser();

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      fileName = target.files[0].name;
      error = null;
    }
  }

  async function loadHardcodedFile() {
    loading = true;
    error = null;

    try {
      // For development, we need to copy the test file to the static folder
      // or use a different approach since browsers can't fetch local file paths
      const response = await fetch('/test1.als');

      if (!response.ok) {
        // Fallback error message with instructions
        throw new Error('Test file not found.');
      }

      const blob = await response.blob();
      const file = new File([blob], 'test1.als');

      await loadAbletonSet(file);
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }

  async function loadSelectedFile() {
    if (!selectedFile) return;
    await loadAbletonSet(selectedFile);
  }

  async function loadAbletonSet(file: File) {
    loading = true;
    error = null;

    try {
      // Parse the ALS file
      const parsedSet = await parser.parseALSFile(file);

      // Load data into DuckDB
      appConfigStore.setCurrentFile(file.name);
      const savedTracks = appConfigStore.get()?.trackCustomizations;
      const trackToName = fromPairs(
        toPairs(savedTracks ?? {})?.map(([trackId, trackCustomization]) => [
          trackCustomization.rawTrackName,
          trackId,
        ]),
      );
      await trackDb.init(parsedSet, trackToName);
      const tracks = await trackDb.get().tracks.getAllTracks();
      appConfigStore.initializeTrackCustomizations(tracks);

      // Update app state to go to main screen
      appStore.setLoadedFile(parsedSet);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to parse ALS file';
      console.error('Error parsing ALS file:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <p class="mt-8">
    <span class="font-bold">To start, choose a .als file.</span>
  </p>
  {#if DEVELOPMENT}
    <!-- Development quick load -->
    <div class="mb-6 text-center">
      <p class="text-base-content/70 mb-4 text-sm">
        For development purposes, load the hardcoded test file:
      </p>

      <button
        class="btn btn-primary btn-lg"
        class:loading
        disabled={loading}
        onclick={loadHardcodedFile}
      >
        {#if loading}
          Loading Project...
        {:else}
          <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
            />
          </svg>
          Load Test Project
        {/if}
      </button>
    </div>

    <div class="divider">Or browse for a file</div>
  {/if}
  <!-- File selection -->
  <div class="mt-4 flex flex-col gap-4">
    {#if fileName}
      <button
        class="btn btn-primary btn-lg justify-start"
        onclick={loadSelectedFile}
        disabled={loading}
      >
        <ArrowRightIcon />
        {#if loading}
          <span class="loading loading-spinner loading-sm"></span>
          Parsing...
        {:else}
          <span class="truncate">Load {fileName}</span>
        {/if}
      </button>
      <button
        class="btn btn-error btn-sm btn-ghost mx-0 justify-start pl-[22px]"
        onclick={() => (fileName = '')}
      >
        <ArrowLeftIcon />
        Choose a different file
      </button>
    {:else}
      <input
        type="file"
        accept=".als"
        class="file-input file-input-primary file-input-xl"
        onchange={handleFileSelect}
      />
    {/if}
  </div>

  {#if error}
    <div class="alert alert-error mt-4">
      <svg class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span class="text-sm">{error}</span>
    </div>
  {/if}
</div>

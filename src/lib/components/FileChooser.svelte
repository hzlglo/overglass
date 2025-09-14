<script lang="ts">
  import { ALSParser } from '../parsers/alsParser';
  import { automationDb } from '../stores/database.svelte';
  import { appStore } from '../stores/app.svelte';

  let selectedFile = $state<File | null>(null);
  let fileName = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

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
      const response = await fetch('/test1.als'); // This would need the file in static/

      if (!response.ok) {
        // Fallback error message with instructions
        throw new Error(
          'Test file not found. To use hardcoded loading: 1) Copy src/tests/test1.als to static/test1.als, or 2) Use the file browser below to select the test file manually.',
        );
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

  $effect(() => {
    if (!selectedFile && !loading) {
      console.log('loading hardcoded file');
      loadHardcodedFile();
    }
  });

  async function loadSelectedFile() {
    if (!selectedFile) return;
    await loadAbletonSet(selectedFile);
  }

  async function loadAbletonSet(file: File) {
    loading = true;
    error = null;

    try {
      // Initialize database if not already done
      await automationDb.init();

      // Parse the ALS file
      const parsedSet = await parser.parseALSFile(file);

      // Load data into DuckDB
      await automationDb.loadALSData(parsedSet);

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

<!-- File chooser card -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title mb-4 justify-center text-center">
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      Load Ableton Project
    </h2>

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

    <!-- File selection -->
    <div class="form-control">
      <label class="label">
        <span class="label-text">Select .als file</span>
      </label>
      <input
        type="file"
        accept=".als"
        class="file-input file-input-bordered w-full"
        onchange={handleFileSelect}
      />

      {#if fileName}
        <div class="mt-4">
          <div class="alert alert-info">
            <span>Selected: {fileName}</span>
          </div>
          <div class="mt-2 text-center">
            <button class="btn btn-primary" onclick={loadSelectedFile} disabled={loading}>
              {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Parsing...
              {:else}
                Load Set
              {/if}
            </button>
          </div>
        </div>
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

    <div class="divider">Future Features</div>

    <div class="text-base-content/50 space-y-2 text-xs">
      <div class="flex items-center gap-2">
        <input type="checkbox" class="checkbox checkbox-xs" disabled />
        <span>Recent projects</span>
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" class="checkbox checkbox-xs" disabled />
        <span>Drag & drop support</span>
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" class="checkbox checkbox-xs" disabled />
        <span>Project templates</span>
      </div>
    </div>
  </div>
</div>

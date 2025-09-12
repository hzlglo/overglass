<script lang="ts">
  import { ALSParser } from '$lib/parsers/alsParser';
  import { ALSDebugger } from '$lib/utils/alsDebugger';
  import { automationDb } from '$lib/stores/database.svelte';
  import DeviceList from '$lib/components/DeviceList.svelte';
  import FileChooser from '$lib/components/FileChooser.svelte';
  import SetSummary from '$lib/components/SetSummary.svelte';
  import type { ParsedALS } from '$lib/types/automation';
  import Debugger from '$lib/components/Debugger.svelte';

  let selectedFile = $state<File | null>(null);
  let fileName = $state('');
  let parsedSet = $state<ParsedALS | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const parser = new ALSParser();

  function handleFileSelect(file: File) {
    selectedFile = file;
    fileName = file.name;
    error = null;
    parsedSet = null;
  }

  async function loadAbletonSet() {
    if (!selectedFile) return;

    loading = true;
    error = null;

    try {
      // Initialize database if not already done
      await automationDb.init();

      // Parse the ALS file
      parsedSet = await parser.parseALSFile(selectedFile);
      console.log('Parsed ALS file:', parsedSet);

      // Load data into DuckDB - this will automatically trigger reactive updates
      await automationDb.loadALSData(parsedSet);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to parse ALS file';
      console.error('Error parsing ALS file:', err);
    } finally {
      loading = false;
    }
  }

  async function debugFile() {
    if (!selectedFile) return;
    await ALSDebugger.debugALSFile(selectedFile);
  }
</script>

<div class="min-h-screen p-8">
  <div class="mx-auto max-w-6xl">
    <!-- Header -->
    <div class="navbar bg-base-300 rounded-box mb-8">
      <div class="flex-1">
        <h1 class="text-xl font-bold">Elektron Automation Editor</h1>
      </div>
      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost">Theme</div>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow"
          >
            <li><button data-set-theme="light" class="w-full">Light</button></li>
            <li><button data-set-theme="dark" class="w-full">Dark</button></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileChooser
      {fileName}
      {loading}
      {error}
      onFileSelect={handleFileSelect}
      onLoadSet={loadAbletonSet}
      onDebugFile={debugFile}
    />

    <!-- Device List -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">Elektron Device Tracks</h2>

        {#if !parsedSet}
          <div class="py-8 text-center">
            <div class="text-base-content/60">
              Select an .als file to view Elektron automation data
            </div>
          </div>
        {:else}
          <DeviceList />

          <!-- Fallback view with parsed data -->
          <!-- <SetSummary {parsedSet} /> -->
        {/if}
      </div>
    </div>
    <Debugger />
  </div>
</div>

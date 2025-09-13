<script lang="ts">
  import '../app.css';
  import { ALSParser } from '$lib/parsers/alsParser';
  import { ALSDebugger } from '$lib/utils/alsDebugger';
  import { automationDb } from '$lib/stores/database.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import FileChooser from '$lib/components/FileChooser.svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import Timeline from '$lib/components/Timeline.svelte';
  import type { ParsedALS } from '$lib/types/automation';
  import Debugger from '$lib/components/Debugger.svelte';

  // FileChooser now handles all the file loading logic internally
</script>

<div class="bg-base-100 min-h-screen">
  {#if appStore.currentScreen === 'file-chooser'}
    <!-- Initial File Chooser Screen -->
    <div
      class="from-base-200 to-base-300 flex min-h-screen items-center justify-center bg-gradient-to-br p-4"
    >
      <div class="w-full max-w-md">
        <!-- App branding -->
        <div class="mb-8 text-center">
          <h1 class="text-primary mb-2 text-4xl font-bold">Overglass</h1>
          <p class="text-base-content/60">Elektron Overbridge Automation Editor</p>
        </div>

        <!-- FileChooser -->
        <FileChooser />
      </div>
    </div>
  {:else}
    <!-- Main Application Screen -->
    <div class="flex h-screen flex-col">
      <!-- Top Navbar -->
      <Navbar
        projectName={appStore.loadedFile?.name || 'Untitled Project'}
        bpm={appStore.loadedFile?.bpm || 120}
      />

      <!-- Main Content Area -->
      <div class="flex-1 overflow-y-auto">
        {#if appStore.showDebugger}
          <Debugger />
        {:else}
          <TrackList />
        {/if}
      </div>

      <!-- Bottom Timeline -->
      <Timeline />
    </div>
  {/if}
</div>

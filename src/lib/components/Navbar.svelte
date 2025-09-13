<script lang="ts">
  import { appStore } from '../stores/app.svelte';

  interface NavbarProps {
    projectName?: string;
    bpm?: number;
  }

  let { projectName = 'Untitled Project', bpm = 120 }: NavbarProps = $props();
</script>

<div class="navbar bg-base-300 border-b border-base-content/10">
  <!-- Left side - Project info -->
  <div class="navbar-start">
    <div class="flex items-center gap-4">
      <button
        class="btn btn-ghost btn-sm"
        onclick={() => appStore.resetApp()}
      >
        ← Back to Files
      </button>

      <div class="divider divider-horizontal"></div>

      <div class="flex flex-col">
        <h1 class="text-lg font-semibold text-base-content">
          {projectName}
        </h1>
        <span class="text-sm text-base-content/60">
          {bpm} BPM
        </span>
      </div>
    </div>
  </div>

  <!-- Center - App title -->
  <div class="navbar-center">
    <span class="text-xl font-bold text-primary">Overglass</span>
  </div>

  <!-- Right side - Controls -->
  <div class="navbar-end">
    <div class="flex items-center gap-2">
      <button
        class="btn btn-outline btn-sm"
        class:btn-active={appStore.showDebugger}
        onclick={() => appStore.toggleDebugger()}
      >
        {appStore.showDebugger ? 'Hide' : 'Show'} Debugger
      </button>

      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-square btn-ghost">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </div>
        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-[1] w-52 p-2 shadow">
          <li><a>Settings</a></li>
          <li><a>Export</a></li>
          <li><a>Help</a></li>
        </ul>
      </div>
    </div>
  </div>
</div>
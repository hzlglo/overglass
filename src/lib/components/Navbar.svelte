<script lang="ts">
  import { appStore } from '../stores/app.svelte';

  interface NavbarProps {
    projectName?: string;
    bpm?: number;
  }

  let { projectName = 'Untitled Project', bpm = 120 }: NavbarProps = $props();

  let timeSignature = $state({ numerator: 4, denominator: 4 });
  let timeSignatureToString = (timeSignature: { numerator: number; denominator: number }) => {
    return `${timeSignature.numerator}/${timeSignature.denominator}`;
  };
</script>

<div class="navbar border-base-100 border-b">
  <!-- Left side - Project info -->
  <div class="navbar-start">
    <div class="flex items-center gap-4">
      <button class="btn btn-ghost btn-sm" onclick={() => appStore.resetApp()}>
        ← Back to Files
      </button>

      <div class="divider divider-horizontal"></div>

      <div class="flex flex-row items-center gap-3">
        <h1 class="text-base-content text-lg font-semibold">
          {projectName}
        </h1>
        <span class="text-base-content/60 text-sm">
          {bpm} BPM
        </span>
        <span class="text-base-content/60 text-sm">
          {timeSignatureToString(timeSignature)}
        </span>
      </div>
    </div>
  </div>

  <!-- Center - App title -->
  <div class="navbar-center">
    <span class="text-primary text-xl font-bold">Overglass</span>
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
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
            />
          </svg>
        </div>
        <!-- TODO: Add settings dropdown -->
      </div>
    </div>
  </div>
</div>

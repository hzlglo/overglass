<script lang="ts">
  import { SettingsIcon } from '@lucide/svelte';
  import { appStore } from '../../stores/app.svelte';
  import ExportButton from './ExportButton.svelte';
  import { goto } from '$app/navigation';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import { sharedXScale } from '../grid/sharedXScale.svelte';
  import PlayButtons from '../play/PlayButtons.svelte';
  import ThemeController from './ThemeController.svelte';

  interface NavbarProps {
    projectName?: string;
    bpm?: number;
  }

  let { projectName = 'Untitled Project', bpm = 120 }: NavbarProps = $props();
  let timeSignature = $state({ numerator: 4, denominator: 4 });
  let timeSignatureToString = (timeSignature: { numerator: number; denominator: number }) => {
    return `${timeSignature.numerator}/${timeSignature.denominator}`;
  };
  let loopLength = $derived(sharedXScale.getLoopLength());
</script>

<div class="navbar border-base-100 flex flex-row justify-between border-b">
  <!-- Left side - Project info -->
  <div class="flex items-center gap-2">
    <button
      class="btn btn-ghost btn-sm"
      onclick={() => {
        appStore.resetApp();
        trackDb.destroy();
        goto('/');
      }}
    >
      ← Back to Files
    </button>

    <div class="divider divider-horizontal"></div>

    <h1 class="text-base-content truncate text-lg font-semibold">
      {projectName}
    </h1>
  </div>

  <div class="flex flex-row items-center gap-2">
    <div class="ml-3 flex grow flex-row flex-nowrap items-center gap-3">
      <span class="text-base-content/60 w-fit">
        {bpm} BPM
      </span>
      <span class="text-base-content/60 w-fit">
        {timeSignatureToString(timeSignature)}
      </span>

      <span class="text-base-content/60 w-fit">
        {loopLength} bars per loop
      </span>
    </div>
    <div class="divider divider-horizontal"></div>
    <PlayButtons />
  </div>

  <!-- Right side - Controls -->
  <div class="flex items-center gap-2">
    <ExportButton />
    <ThemeController />

    <button
      class="btn btn-ghost btn-sm"
      onclick={() => {
        if (window.location.pathname.endsWith('/settings')) {
          goto('/');
          return;
        }
        goto('/settings');
      }}
    >
      <SettingsIcon />
    </button>
  </div>
</div>

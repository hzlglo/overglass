<script lang="ts">
  import { SettingsIcon } from '@lucide/svelte';
  import { appStore } from '../../stores/app.svelte';
  import ExportButton from './ExportButton.svelte';
  import { goto } from '$app/navigation';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import { sharedXScale } from '../grid/sharedXScale.svelte';
  import PlayButtons from '../play/PlayButtons.svelte';

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

<div class="navbar border-base-100 border-b">
  <!-- Left side - Project info -->
  <div class="navbar-start flex items-center gap-2">
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

    <h1 class="text-base-content text-lg font-semibold">
      {projectName}
    </h1>

    <div class="divider divider-horizontal"></div>
    <div class="ml-3 flex flex-row items-center gap-3">
      <span class="text-base-content/60 text-sm">
        {bpm} BPM
      </span>
      <span class="text-base-content/60 text-sm">
        {timeSignatureToString(timeSignature)}
      </span>

      <span class="text-base-content/60 text-sm">
        {loopLength} bars per loop
      </span>
    </div>
  </div>

  <div class="navbar-center">
    <PlayButtons />
  </div>

  <!-- Right side - Controls -->
  <div class="navbar-end">
    <div class="flex items-center gap-2">
      <ExportButton />

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
</div>

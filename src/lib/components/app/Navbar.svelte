<script lang="ts">
  import { EllipsisVerticalIcon } from '@lucide/svelte';
  import { appStore } from '../../stores/app.svelte';
  import ExportButton from './ExportButton.svelte';
  import Menu from '../core/Menu.svelte';
  import { goto } from '$app/navigation';
  import { trackDb } from '$lib/stores/trackDb.svelte';

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
      <ExportButton />

      <Menu
        options={[
          { label: 'Settings', onSelect: () => {} },
          { label: 'Debugger', onSelect: () => goto('/debugger') },
        ]}
        triggerClass="btn btn-ghost btn-sm"
      >
        {#snippet trigger()}
          <EllipsisVerticalIcon />
        {/snippet}
      </Menu>
    </div>
  </div>
</div>

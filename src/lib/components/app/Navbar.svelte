<script lang="ts">
  import { goto } from '$app/navigation';
  import { SettingsIcon } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { appStore } from '../../stores/app.svelte';
  import Popover from '../core/Popover.svelte';
  import PlayButtons from '../play/PlayButtons.svelte';
  import ExportButton from './ExportButton.svelte';
  import HelpModal from './HelpModal.svelte';
  import ThemeController from './ThemeController.svelte';

  let { backAction }: { backAction?: Snippet } = $props();

  let fileMetadata = $derived(appStore.getFileMetadata());

  let projectName = $derived(fileMetadata?.name || 'Untitled Project');
  let bpm = $derived(fileMetadata?.bpm || 120);
  let timeSignature = $derived(fileMetadata?.meter || { numerator: 4, denominator: 4 });
  let timeSignatureToString = (timeSignature: { numerator: number; denominator: number }) => {
    return `${timeSignature.numerator}/${timeSignature.denominator}`;
  };
  // let loopLength = $derived(sharedXScale.getLoopLength());
</script>

<div class="navbar border-base-content/20 flex flex-row justify-between border-b">
  <!-- Left side - Project info -->
  <div class="flex h-full min-w-0 shrink items-center">
    {@render backAction?.()}

    <div class="divider divider-horizontal"></div>

    <h3
      class="max-w-[300px] min-w-[50px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
      title={projectName}
    >
      {projectName}
    </h3>
  </div>
  <div class="flex shrink-0 items-center gap-2">
    <Popover>
      {#snippet content()}
        <div class="bg-base-100 border-base-content/20 flex w-[250px] flex-col gap-2 border p-4">
          <label class="input">
            <span class="label">BPM</span>
            <input
              type="number"
              value={bpm}
              onchange={(e) => {
                bpm = parseInt((e.target as HTMLInputElement).value);
                appStore.updateFileMetadata((metadata) => ({ ...metadata, bpm }));
              }}
            />
          </label>
          <div class="flex flex-row gap-2">
            <label class="input">
              <span class="label">Meter</span>
              <input
                type="number"
                value={timeSignature.numerator}
                onchange={(e) => {
                  const updated = parseInt((e.target as HTMLInputElement).value);
                  appStore.updateFileMetadata((metadata) => ({
                    ...metadata,
                    meter: { ...metadata.meter, numerator: updated },
                  }));
                }}
              />
              /
              <input
                type="number"
                value={timeSignature.denominator}
                onchange={(e) => {
                  timeSignature.denominator = parseInt((e.target as HTMLInputElement).value);
                  appStore.updateFileMetadata((metadata) => ({
                    ...metadata,
                    meter: { ...metadata.meter, denominator: timeSignature.denominator },
                  }));
                }}
              />
            </label>
          </div>
        </div>
      {/snippet}
      <span class="text-base-content/60 w-fit">
        {bpm} BPM
      </span>
      <span class="text-base-content/60 w-fit">
        {timeSignatureToString(timeSignature)}
      </span>
    </Popover>

    <!-- <span class="text-base-content/60 w-fit">
        {loopLength} bars per loop
      </span> -->
    <div class="divider divider-horizontal"></div>
    <PlayButtons />
  </div>

  <!-- Right side - Controls -->
  <div class="flex shrink-0 items-center gap-2">
    <ExportButton />
    <HelpModal />
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

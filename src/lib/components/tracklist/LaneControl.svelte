<script lang="ts">
  import type { Snippet } from 'svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
  import classNames from 'classnames';
  import { CheckIcon, PencilIcon } from '@lucide/svelte';

  interface TrackLaneProps {
    title?: string;
    onRename?: (newTitle: string) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    children?: Snippet;
    laneId: string;
    class?: string;
    actions?: Snippet;
  }

  let {
    title,
    onRename,
    isExpanded: isExpandedProp,
    onToggleExpanded,
    children,
    laneId,
    class: className,
    actions,
  }: TrackLaneProps = $props();

  // if isExpandedProp is not provided, show the content
  let isExpanded = $derived(isExpandedProp === undefined ? true : isExpandedProp);

  let height = $derived(gridDisplayState.getLaneHeight(laneId));
  let isRenaming = $state(false);
  let newTitle = $state(title || '');
</script>

<div class="min-w-0">
  <div class="border-base-100 box-border w-[300px] border" style="height: {height}px">
    <div class="flex flex-row">
      {#if onToggleExpanded}
        <button class="btn btn-xs btn-ghost" onclick={onToggleExpanded}>
          {isExpanded ? '▼' : '▶'}
        </button>
      {/if}
      <div class="group flex w-full flex-row justify-between pr-4">
        <div class="group flex flex-row gap-1">
          <div
            class={classNames(
              !isExpanded ? 'text-base-content/60' : 'text-base-content',
              className,
            )}
          >
            {#if isRenaming}
              <input type="text" bind:value={newTitle} />
            {:else}
              {title}
            {/if}
          </div>
          {#if isRenaming && onRename}
            <button
              class="btn btn-xs btn-ghost"
              onclick={() => {
                onRename(newTitle);
                isRenaming = false;
              }}
            >
              <CheckIcon class="size-3" />
            </button>
          {:else}
            <button
              class="btn btn-xs btn-ghost hidden group-hover:block"
              onclick={() => (isRenaming = true)}
            >
              <PencilIcon class="size-3" />
            </button>
          {/if}
        </div>
        {@render actions?.()}
      </div>
    </div>
  </div>
  {#if isExpanded && children}
    {@render children()}
  {/if}
</div>

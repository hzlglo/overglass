<script lang="ts">
  import type { Snippet } from 'svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
  import classNames from 'classnames';
  import { CheckIcon, PencilIcon } from '@lucide/svelte';

  interface TrackLaneProps {
    title?: string;
    subtitle?: string;
    onRename?: (newTitle: string) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    children?: Snippet;
    laneId: string;
    class?: string;
    actions?: Snippet;
    inlineActions?: Snippet;
    color?: string;
  }

  let {
    title,
    subtitle,
    onRename,
    isExpanded: isExpandedProp,
    onToggleExpanded,
    children,
    laneId,
    class: className,
    actions,
    inlineActions,
    color,
  }: TrackLaneProps = $props();

  // if isExpandedProp is not provided, show the content
  let isExpanded = $derived(isExpandedProp === undefined ? true : isExpandedProp);

  let height = $derived(gridDisplayState.getLaneHeight(laneId));
  let isRenaming = $state(false);
  let newTitle = $state(title || '');
</script>

<div class="mr-2 min-w-0">
  <div
    class="group box-border w-[300px] border-l-4"
    style="height: {height}px; border-color: {color}"
  >
    <div class="flex flex-row border-t-[0.5px]">
      {#if onToggleExpanded}
        <button class="btn btn-xs btn-ghost" onclick={onToggleExpanded}>
          {isExpanded ? '▼' : '▶'}
        </button>
      {/if}
      <div class="group flex w-full flex-row justify-between">
        <div
          class={classNames(!isExpanded ? 'text-base-content/60' : 'text-base-content', className)}
        >
          {#if isRenaming}
            <input
              type="text"
              bind:value={newTitle}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  onRename?.(newTitle);
                  isRenaming = false;
                }
              }}
            />
          {:else}
            {title}
          {/if}
        </div>
        <div class="flex flex-row gap-1">
          {#if onRename}
            {#if isRenaming}
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
          {/if}
          {@render inlineActions?.()}
        </div>
      </div>
    </div>

    <div class="ml-7 flex flex-col">
      {#if subtitle && isExpanded}
        <div class="text-base-content/60 text-sm">
          {subtitle}
        </div>
      {/if}
      {@render actions?.()}
    </div>
  </div>
  {#if isExpanded && children}
    {@render children()}
  {/if}
</div>

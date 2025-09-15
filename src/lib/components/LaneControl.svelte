<script lang="ts">
  import type { Snippet } from 'svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import classNames from 'classnames';

  interface TrackLaneProps {
    title?: string;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    children?: Snippet;
    laneId: string;
  }

  let {
    title,
    isExpanded: isExpandedProp,
    onToggleExpanded,
    children,
    laneId,
  }: TrackLaneProps = $props();

  // if isExpandedProp is not provided, show the content
  let isExpanded = $derived(isExpandedProp === undefined ? true : isExpandedProp);

  let height = $derived(gridDisplayState.getLaneHeight(laneId));
</script>

<div class="min-w-0">
  <div class="border-base-100 box-border w-[300px] border" style="height: {height}px">
    <div class="flex flex-row">
      {#if onToggleExpanded}
        <button class="btn btn-xs btn-ghost" onclick={onToggleExpanded}>
          {isExpanded ? '▼' : '▶'}
        </button>
      {/if}
      <div class={!isExpanded ? 'text-base-content/60' : 'text-base-content'}>
        {title}
      </div>
    </div>
  </div>
  {#if isExpanded && children}
    {@render children()}
  {/if}
</div>

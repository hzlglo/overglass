<script lang="ts">
  import type { Snippet } from 'svelte';

  interface TrackLaneProps {
    title?: string;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    body: Snippet;
    right: Snippet;
    children: Snippet;
  }

  let {
    title,
    isExpanded: isExpandedProp,
    onToggleExpanded,
    body,
    right,
    children,
  }: TrackLaneProps = $props();

  // if isExpandedProp is not provided, show the content
  let isExpanded = $derived(isExpandedProp === undefined ? true : isExpandedProp);
</script>

<div class="border-base-300 border">
  <div class="flex flex-row">
    <div class="flex-1">
      {#if isExpanded}
        {@render body()}
      {/if}
    </div>
    <div class="w-[300px]">
      <div class="flex flex-row">
        {#if onToggleExpanded}
          <button class="btn btn-xs" onclick={onToggleExpanded}>
            {isExpanded ? '▼' : '▶'}
          </button>
        {/if}
        <div class="">
          {title}
        </div>
      </div>
      {#if isExpanded}
        {@render right()}
      {/if}
    </div>
  </div>
  {#if isExpanded}
    {@render children()}
  {/if}
</div>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface VirtualizedLaneProps {
    height: number;
    width: number;
    yPosition: number;
    gridScroll: number;
    gridHeight: number;
    children: Snippet;
  }

  let { height, width, yPosition, gridScroll, gridHeight, children }: VirtualizedLaneProps =
    $props();

  // only render lanes if they are close to being visible
  let buffer = 100;
  let isVisible = $derived(
    yPosition + height + buffer > gridScroll && yPosition - buffer < gridScroll + gridHeight,
  );
</script>

{#if isVisible}
  <g transform={`translate(0,${yPosition})`} {width}>{@render children()}</g>
{/if}

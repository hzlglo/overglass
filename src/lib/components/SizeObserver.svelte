<script lang="ts">
  import { isEmpty } from 'lodash';
  import type { Snippet } from 'svelte';

  let {
    width = $bindable(),
    height = $bindable(),
    children,
  }: { width: number; height: number; children: Snippet } = $props();

  let container = $state<HTMLDivElement>();
  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      if (isEmpty(entries)) return;
      width = entries[0].contentRect.width;
      height = entries[0].contentRect.height;
    });
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<div bind:this={container} class="flex min-h-0 min-w-0 flex-1">
  {@render children()}
</div>

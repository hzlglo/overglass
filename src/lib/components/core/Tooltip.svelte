<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    children,
    content,
    contentString,
  }: { children: Snippet; content?: Snippet; contentString?: string } = $props();
</script>

<Tooltip.Provider>
  <Tooltip.Root delayDuration={200}>
    <Tooltip.Trigger>
      {@render children()}
    </Tooltip.Trigger>
    <Tooltip.Content sideOffset={8}>
      {@render content?.()}
      {#if contentString}
        <div class="bg-base-100 border-base-content/20 border p-2 text-sm">
          {contentString}
        </div>
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>

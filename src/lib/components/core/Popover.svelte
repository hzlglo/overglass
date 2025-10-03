<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let { children, content }: { children: Snippet; content: Snippet } = $props();
</script>

<Popover.Root>
  <Popover.Trigger>
    {@render children()}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content class="z-50">
      {@render content()}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

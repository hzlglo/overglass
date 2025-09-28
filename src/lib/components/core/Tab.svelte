<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let { value, children }: { value: string; children: Snippet } = $props();
</script>

<Tabs.Content {value} class="">{@render children()}</Tabs.Content>

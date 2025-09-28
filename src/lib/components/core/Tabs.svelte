<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let { options, children }: { options: { label?: string; value: string }[]; children: Snippet } =
    $props();
</script>

<Tabs.Root class="">
  <Tabs.List class="tabs">
    {#each options as option}
      <Tabs.Trigger value={option.value} class="tab data-[state=active]:tab-active "
        >{option.label ?? option.value}</Tabs.Trigger
      >
    {/each}
  </Tabs.List>
  {@render children()}
</Tabs.Root>

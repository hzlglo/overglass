<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let {
    options,
    children,
    value = $bindable(),
  }: { options: { label?: string; value: string }[]; children: Snippet; value?: string } = $props();
</script>

<Tabs.Root class="" bind:value>
  <Tabs.List class="tabs">
    {#each options as option}
      <Tabs.Trigger value={option.value} class="tab data-[state=active]:tab-active "
        >{option.label ?? option.value}</Tabs.Trigger
      >
    {/each}
  </Tabs.List>
  {@render children()}
</Tabs.Root>

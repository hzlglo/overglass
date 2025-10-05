<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let {
    options,
    children,
    value = $bindable(),
    class: className,
  }: {
    options: { label?: string; value: string }[];
    children: Snippet;
    value?: string;
    class?: string;
  } = $props();
</script>

<Tabs.Root class={className} bind:value>
  <Tabs.List class="tabs">
    {#each options as option}
      <Tabs.Trigger value={option.value} class="tab data-[state=active]:tab-active "
        >{option.label ?? option.value}</Tabs.Trigger
      >
    {/each}
  </Tabs.List>
  {@render children()}
</Tabs.Root>

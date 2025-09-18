<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    trigger,
    options,
    triggerClass,
  }: {
    trigger: Snippet;
    triggerClass?: string;
    options: { label: string; onSelect: () => void }[];
  } = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class={triggerClass}>
    {@render trigger()}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content class="menu rounded-box bg-base-100 border-base-content/20 border">
      {#each options as option}
        <DropdownMenu.Item class="btn btn-sm btn-ghost btn-left" onSelect={option.onSelect}>
          {option.label}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

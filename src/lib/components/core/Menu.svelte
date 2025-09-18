<script lang="ts">
  import { Menu } from '@ark-ui/svelte/menu';
  import type { Snippet } from 'svelte';

  let {
    trigger,
    options,
    triggerClass,
  }: {
    trigger: Snippet;
    triggerClass?: string;
    options: { value?: string; label: string; onSelect: () => void }[];
  } = $props();

  let open = $state(false);
  $inspect('open', open);
</script>

<Menu.Root
  bind:open
  onSelect={(val) => {
    console.log(val);
    options.find((option) => (option.value ?? option.label) === val.value)?.onSelect();
    open = false;
  }}
>
  <Menu.Trigger class={triggerClass}>
    {@render trigger()}
  </Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content class="menu rounded-box bg-base-100 border-base-content/20 border">
      {#each options as option}
        <Menu.Item value={option.value ?? option.label} class="btn btn-sm btn-ghost btn-left">
          {option.label}
        </Menu.Item>
      {/each}
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>

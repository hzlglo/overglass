<script lang="ts">
  import { Portal } from '@ark-ui/svelte/portal';
  import { Select, createListCollection } from '@ark-ui/svelte/select';
  import { ChevronDownIcon } from '@lucide/svelte';

  let { label, options, placeholder }: { label: string; options: string[]; placeholder?: string } =
    $props();

  const collection = $derived(createListCollection({ items: options }));
</script>

<Select.Root {collection} class="flex flex-row gap-1">
  <Select.Label>{label}</Select.Label>
  <Select.Control>
    <Select.Trigger>
      <Select.ValueText {placeholder} />
      <Select.Indicator>
        <ChevronDownIcon />
      </Select.Indicator>
    </Select.Trigger>
    <!-- <Select.ClearTrigger>Clear</Select.ClearTrigger> -->
  </Select.Control>
  <Portal>
    <Select.Positioner class="menu rounded-box data-[state=open]:bg-base-100">
      <Select.Content>
        {#each collection.items as item}
          <Select.Item {item}>
            <Select.ItemText>{item}</Select.ItemText>
            <Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Positioner>
  </Portal>
  <Select.HiddenSelect />
</Select.Root>

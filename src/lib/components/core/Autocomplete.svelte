<script lang="ts">
  import { Select } from 'bits-ui';

  let {
    options,
  }: {
    options: { label: string; onSelect: () => void }[];
  } = $props();
  let value = $state('');
</script>

<!-- TODO make this work like a normal autocomplete component -->
<Select.Root
  type="single"
  bind:value={value as never}
  onValueChange={(newVal) => {
    options.find((o) => o.label === newVal)?.onSelect();
  }}
>
  <Select.Trigger>
    <input type="text" class="input input-bordered" bind:value />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      class="menu rounded-box bg-base-100 border-base-content/20 max-h-[200px] overflow-y-auto border"
    >
      <Select.Viewport class="flex flex-col gap-1">
        {#each options as { label, onSelect } (label)}
          <Select.Item
            value={label}
            {label}
            onselect={onSelect}
            class="btn btn-sm btn-ghost justify-start"
          >
            {label}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>

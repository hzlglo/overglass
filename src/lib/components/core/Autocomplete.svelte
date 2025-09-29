<script lang="ts">
  import { Select } from 'bits-ui';

  let {
    options,
    placeholder,
    open = $bindable(false),
  }: {
    options: { label: string; value: string; onSelect: () => void }[];
    placeholder: string;
    open: boolean;
  } = $props();
</script>

<!-- TODO make this work like a normal autocomplete component -->
<Select.Root
  type="single"
  bind:open
  onValueChange={(newVal) => {
    options.find((o) => o.value === newVal)?.onSelect();
  }}
>
  <Select.Trigger>
    <input type="text" class="input input-bordered input-sm w-fit" {placeholder} />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      class="menu rounded-box bg-base-100 border-base-content/20 max-h-[200px] overflow-y-auto border"
    >
      <Select.Viewport class="flex flex-col gap-1">
        {#each options as { label, value } (label)}
          <Select.Item {value} {label} class="btn btn-sm btn-ghost justify-start">
            {label}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>

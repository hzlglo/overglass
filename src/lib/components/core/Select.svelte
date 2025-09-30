<script lang="ts">
  import { Select } from 'bits-ui';
  import classNames from 'classnames';

  let {
    options,
    value = $bindable(),
    placeholder,
    triggerClass,
  }: {
    options: { label: string; value: string }[];
    value: string | undefined;
    placeholder: string;
    triggerClass?: string;
  } = $props();

  $inspect('select', { value, placeholder });
</script>

<Select.Root type="single" bind:value>
  <Select.Trigger class={classNames('select', triggerClass)}>
    <span class="text-base-content text-sm">
      {value || placeholder}
    </span>
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

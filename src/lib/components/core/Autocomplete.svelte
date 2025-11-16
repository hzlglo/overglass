<script lang="ts">
  import { CheckIcon } from '@lucide/svelte';
  import { Combobox } from 'bits-ui';
  import classNames from 'classnames';
  let {
    options,
    placeholder,
    open = $bindable(false),
    onchange,
    class: className,
  }: {
    options: { label: string; value: string }[];
    placeholder: string;
    open?: boolean;
    onchange: (value: string) => void;
    class?: string;
  } = $props();

  let searchValue = $state('');

  const filteredOptions = $derived(
    searchValue === ''
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase())),
  );
</script>

<Combobox.Root
  type="single"
  onOpenChangeComplete={(o) => {
    if (!o) searchValue = '';
  }}
  onValueChange={(value) => {
    onchange(value);
    open = false;
  }}
  bind:open
>
  <Combobox.Input
    oninput={(e) => (searchValue = e.currentTarget.value)}
    class={classNames('select select-sm', className)}
    {placeholder}
    aria-label={placeholder}
  />
  <Combobox.Portal>
    <Combobox.Content
      class="focus-override border-neutral bg-base-100 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-96 max-h-[var(--bits-combobox-content-available-height)] w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] rounded-xl border px-1 py-3 outline-hidden select-none data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
      sideOffset={10}
    >
      <Combobox.Viewport class="p-1">
        {#each filteredOptions as option, i (i + option.value)}
          <Combobox.Item
            class="data-highlighted:bg-neutral flex h-10 w-full items-center py-3 pr-1.5 pl-5 text-sm capitalize outline-hidden select-none"
            value={option.value}
            label={option.label}
          >
            {#snippet children({ selected })}
              {option.label}
              {#if selected}
                <div class="ml-auto">
                  <CheckIcon />
                </div>
              {/if}
            {/snippet}
          </Combobox.Item>
        {:else}
          <span class="block px-5 py-2 text-sm"> No results found, try again. </span>
        {/each}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

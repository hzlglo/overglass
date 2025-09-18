<script lang="ts">
  import { CheckIcon } from '@lucide/svelte';
  import { Popover } from 'bits-ui';
  import classNames from 'classnames';
  import { colorOptions } from './colorOptions';

  let {
    value,
    onValueChange,
    class: className,
  }: { value: string; onValueChange: (color: string) => void; class?: string } = $props();

  let isOpen = $state(false);
</script>

<Popover.Root bind:open={isOpen}>
  <Popover.Trigger class={classNames('group-hover:block', isOpen ? 'block' : 'hidden', className)}>
    <button class="btn btn-xs btn-square" aria-label="Color Chooser">
      <div class="size-4" style="background-color: {value}"></div>
    </button>
  </Popover.Trigger>
  <Popover.Content class="menu rounded-box bg-base-100 border-base-content/20 border">
    <div class="flex flex-row gap-1">
      {#each colorOptions as colorGroup}
        <div class="flex flex-col gap-1">
          {#each colorGroup as color}
            <button
              class="btn btn-sm btn-square"
              style="background-color: {color}"
              onclick={() => {
                console.log('clicked', color);
                onValueChange(color);
                isOpen = false;
              }}
            >
              {#if value === color}
                <CheckIcon class="text-base-content size-4" strokeWidth={3}></CheckIcon>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>

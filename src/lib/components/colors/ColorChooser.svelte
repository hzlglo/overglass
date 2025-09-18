<script lang="ts">
  import { ColorPicker, parseColor } from '@ark-ui/svelte/color-picker';
  import { colorOptions, toHex } from './colorOptions';
  import { transpose } from '$lib/utils/utils';
  import classNames from 'classnames';
  import { CheckIcon } from '@lucide/svelte';

  let {
    value,
    onValueChange,
    class: className,
  }: { value: string; onValueChange: (color: string) => void; class?: string } = $props();

  let valueColor = $derived(parseColor(toHex(value) || '#F00'));

  let colorOptionsGroups = $derived(
    transpose(colorOptions.map((colorGroup) => colorGroup.map((color) => parseColor(color)))),
  );
  let isOpen = $state(false);
</script>

<ColorPicker.Root
  value={valueColor}
  onValueChange={(newValue) => {
    onValueChange(newValue.value.toString('hex'));
  }}
  class={classNames('group-hover:block', isOpen ? 'block' : 'hidden', className)}
  bind:open={isOpen}
>
  <ColorPicker.Control>
    <ColorPicker.Trigger>
      <ColorPicker.ValueSwatch class="btn btn-xs btn-square" />
    </ColorPicker.Trigger>
  </ColorPicker.Control>
  <ColorPicker.Positioner>
    <ColorPicker.Content class="menu rounded-box bg-base-100 border-base-content/20 border">
      {#each colorOptionsGroups as colorGroup}
        <ColorPicker.SwatchGroup>
          {#each colorGroup as color}
            <ColorPicker.SwatchTrigger value={color}>
              <ColorPicker.Swatch value={color} class="btn btn-sm btn-square">
                {#if value === color.toString('hex')}
                  <ColorPicker.SwatchIndicator>
                    {#snippet asChild()}
                      <CheckIcon class="text-base-content size-4" strokeWidth={3}></CheckIcon>
                    {/snippet}
                  </ColorPicker.SwatchIndicator>
                {/if}
              </ColorPicker.Swatch>
            </ColorPicker.SwatchTrigger>
          {/each}
        </ColorPicker.SwatchGroup>
      {/each}
    </ColorPicker.Content>
  </ColorPicker.Positioner>
  <ColorPicker.HiddenInput />
</ColorPicker.Root>

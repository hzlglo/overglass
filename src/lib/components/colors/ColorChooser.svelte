<script lang="ts">
  import { ColorPicker, parseColor } from '@ark-ui/svelte/color-picker';
  import { colorOptions, toHex } from './colorOptions';
  import { transpose } from '$lib/utils/utils';

  let { value, onValueChange }: { value: string; onValueChange: (color: string) => void } =
    $props();

  let valueColor = $derived(parseColor(toHex(value) || '#F00'));

  let colorOptionsGroups = $derived(
    transpose(colorOptions.map((colorGroup) => colorGroup.map((color) => parseColor(color)))),
  );
</script>

<div>
  <ColorPicker.Root
    value={valueColor}
    onValueChange={(newValue) => {
      onValueChange(newValue.value.toString('hex'));
    }}
  >
    <ColorPicker.Control>
      <ColorPicker.Trigger>
        <ColorPicker.ValueSwatch class="btn btn-sm" />
      </ColorPicker.Trigger>
    </ColorPicker.Control>
    <ColorPicker.Positioner>
      <ColorPicker.Content>
        {#each colorOptionsGroups as colorGroup}
          <ColorPicker.SwatchGroup>
            {#each colorGroup as color}
              <ColorPicker.SwatchTrigger value={color}>
                <ColorPicker.Swatch value={color} class="btn btn-sm">
                  {#if value === color.toString('hex')}
                    <ColorPicker.SwatchIndicator>✓</ColorPicker.SwatchIndicator>
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
</div>

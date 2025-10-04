<script lang="ts">
  import { MoonIcon, SunIcon } from '@lucide/svelte';
  import { regenerateColorOptions } from '../colors/colorOptions';
  import { onMount, tick } from 'svelte';
  import { appConfigStore } from '$lib/stores/customization.svelte';

  const themeStorageKey = 'isDarkMode';

  let isDarkMode = $state(false);

  onMount(() => {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored !== null) {
      isDarkMode = stored === 'true';
    }
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'overglass-dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'emerald');
    }
  });
  $effect(() => {
    let _x = isDarkMode;
    tick().then(() => {
      regenerateColorOptions();
      appConfigStore.randomizeTrackColors();
    });
  });
</script>

<label class="swap swap-rotate">
  <input
    type="checkbox"
    class="theme-controller"
    value={isDarkMode ? 'overglass-dark' : 'emerald'}
    onchange={() => {
      isDarkMode = !isDarkMode;
      document.documentElement.setAttribute(
        'data-theme',
        isDarkMode ? 'overglass-dark' : 'emerald',
      );

      localStorage.setItem(themeStorageKey, isDarkMode.toString());
    }}
  />
  {#if isDarkMode}
    <MoonIcon />
  {:else}
    <SunIcon />
  {/if}
</label>

<script lang="ts">
  import { MoonIcon, SunIcon } from '@lucide/svelte';
  import { regenerateColorOptions } from '../colors/colorOptions';
  import { onMount, tick } from 'svelte';
  import { appConfigStore } from '$lib/stores/customization.svelte';

  const themeStorageKey = 'isDarkMode';

  let isDarkMode = $state(true);

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
</script>

<label class="swap swap-rotate btn-square btn btn-ghost btn-sm">
  <input
    type="checkbox"
    title="Toggle light/dark mode"
    class="theme-controller"
    value={isDarkMode ? 'overglass-dark' : 'emerald'}
    onchange={() => {
      isDarkMode = !isDarkMode;
      document.documentElement.setAttribute(
        'data-theme',
        isDarkMode ? 'overglass-dark' : 'emerald',
      );
      regenerateColorOptions();
      appConfigStore.randomizeTrackColors();

      localStorage.setItem(themeStorageKey, isDarkMode.toString());
    }}
  />
  {#if isDarkMode}
    <MoonIcon />
  {:else}
    <SunIcon />
  {/if}
</label>

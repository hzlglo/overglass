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
      document.documentElement.setAttribute('data-theme', 'forest');
    } else {
      document.documentElement.setAttribute('data-theme', 'fantasy');
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

<label class="swap swap-rotate pl-3">
  <input
    type="checkbox"
    class="theme-controller"
    value={isDarkMode ? 'forest' : 'fantasy'}
    onchange={() => {
      isDarkMode = !isDarkMode;
      document.documentElement.setAttribute('data-theme', isDarkMode ? 'forest' : 'fantasy');

      localStorage.setItem(themeStorageKey, isDarkMode.toString());
    }}
  />
  {#if isDarkMode}
    <MoonIcon />
  {:else}
    <SunIcon />
  {/if}
</label>

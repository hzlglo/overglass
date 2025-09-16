<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { automationDb } from '$lib/stores/database.svelte';
  import { debounce } from 'lodash';

  let value = $state('');
  let valueDebounced = $state('');
  const updateValueDebounced = () => {
    valueDebounced = value;
  };
  const debouncedUpdate = debounce(updateValueDebounced, 500);
  $effect(() => debouncedUpdate(value));
  let db = $derived(automationDb.get());

  let res = $derived.by(() => {
    if (value === '' || !db) {
      return [];
    }
    return db.run(valueDebounced);
  });
</script>

<h3>Debug</h3>
<div class="flex flex-row gap-2">
  <button class="btn btn-sm btn-ghost" onclick={() => appConfigStore.clearAllCustomizations()}
    >Clear app state</button
  >
</div>
<textarea bind:value></textarea>
{#await res}
  running query...
{:then resolved}
  <pre>
  {JSON.stringify(resolved, null, 4)}
</pre>
{/await}

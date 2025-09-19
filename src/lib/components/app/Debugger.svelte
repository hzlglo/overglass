<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import { debounce } from 'lodash';

  let value = $state('');
  let valueDebounced = $state('');
  const updateValueDebounced = () => {
    valueDebounced = value;
  };
  const debouncedUpdate = debounce(updateValueDebounced, 500);
  $effect(() => debouncedUpdate(value));
  let db = $derived(trackDb.get());

  let res = $derived.by(() => {
    if (value === '' || !db) {
      return [];
    }
    return db.run(valueDebounced);
  });
</script>

<div class="border-base-content/20 flex w-full flex-col gap-2 border-t p-4">
  <div class="flex flex-row justify-between">
    <h1>Debug</h1>
    <button class="btn btn-sm btn-error" onclick={() => appConfigStore.clearAllCustomizations()}>
      Clear app state
    </button>
  </div>
  <div class="flex flex-col gap-2">
    <p>Enter SQL</p>
    <textarea bind:value class="textarea textarea-bordered"> </textarea>
  </div>
  {#await res}
    running query...
  {:then resolved}
    <pre>
  {JSON.stringify(resolved, null, 4)}
</pre>
  {/await}
</div>

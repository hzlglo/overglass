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
    <textarea bind:value class="textarea textarea-bordered w-full"> </textarea>
  </div>
  {#await res}
    running query...
  {:then resolved}
    {#if resolved.length > 0}
      {@const columns = Object.keys(resolved[0])}
      <table class="table-pin-rows table border">
        <thead>
          <tr>
            {#each columns as column}
              <th>{column}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each resolved as row}
            <tr>
              {#each columns as column}
                <td>{row[column]}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/await}
</div>

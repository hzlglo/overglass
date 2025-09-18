<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import { automationDb } from '$lib/stores/database.svelte';
  import { Field } from '@ark-ui/svelte';
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

<div class="flex w-full flex-col gap-2">
  <div class="flex flex-row justify-between">
    <h3>Debug</h3>
    <button class="btn btn-sm btn-error" onclick={() => appConfigStore.clearAllCustomizations()}>
      Clear app state
    </button>
  </div>
  <Field.Root class="flex flex-col gap-2">
    <Field.Label>Enter SQL</Field.Label>
    <Field.Context>
      {#snippet render(field)}
        <textarea {...field().getTextareaProps()} bind:value class="textarea textarea-bordered">
        </textarea>
      {/snippet}
    </Field.Context>
  </Field.Root>
  {#await res}
    running query...
  {:then resolved}
    <pre>
  {JSON.stringify(resolved, null, 4)}
</pre>
  {/await}
</div>

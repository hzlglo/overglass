<script lang="ts">
  import {
    sharedGridState,
    type ParameterLaneState,
  } from '$lib/components/grid/sharedGridState.svelte';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import Modal from '../../core/Modal.svelte';

  let {
    parameterLaneState,
    isOpen = $bindable(false),
  }: { parameterLaneState: ParameterLaneState; isOpen: boolean } = $props();
</script>

<Modal titleString="Delete Lane" bind:isOpen>
  {#snippet content()}
    <div class="h-2xl flex min-h-0 w-2xl flex-col gap-2 p-4">
      <p>Are you sure you want to delete {parameterLaneState.parameter.parameterName}?</p>
      <div class="flex flex-row justify-end gap-2">
        <button
          class="btn btn-ghost"
          onclick={() => {
            isOpen = false;
          }}
        >
          Close
        </button>
        <button
          class="btn btn-error"
          onclick={async () => {
            await trackDb.get().tracks.deleteParameter(parameterLaneState.parameter.id);
            await trackDb.refreshData();
            await sharedGridState.syncWithDb(trackDb.get());
            isOpen = false;
          }}
        >
          Delete
        </button>
      </div>
    </div>
  {/snippet}
</Modal>

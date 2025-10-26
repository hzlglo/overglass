<script lang="ts">
  import { appModalState } from './appModalState.svelte';
  import NewLaneModal from './NewLaneModal.svelte';

  let modal = $derived(appModalState.getModal());
  let isOpen = $state(false);

  $effect(() => {
    if (modal) {
      isOpen = true;
    }
  });
  $effect(() => {
    if (!modal) {
      appModalState.setModal(null);
    }
  });
</script>

{#if modal}
  {#if modal?.type === 'newLane'}
    <NewLaneModal {...modal.props} bind:isOpen />
  {/if}
{/if}

<script lang="ts">
  import { appModalState } from './appModalState.svelte';
  import NewLaneModal from './NewLaneModal.svelte';
  import DeleteParameterModal from './DeleteParameterModal.svelte';
  import ChangeParameterModal from './ChangeParameterModal.svelte';

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
  {#if modal?.type === 'deleteParameter'}
    <DeleteParameterModal {...modal.props} bind:isOpen />
  {/if}
  {#if modal?.type === 'changeParameter'}
    <ChangeParameterModal {...modal.props} bind:isOpen />
  {/if}
{/if}

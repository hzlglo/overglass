<script lang="ts">
  import { actionsDispatcher } from './actionsDispatcher.svelte';

  let contextMenuState = $derived(actionsDispatcher.getContextMenuState());
  console.log('contextMenuState', contextMenuState);

  // Convert menu items to format expected by Menu component
  let menuOptions = $derived(
    contextMenuState?.menuItems.map((item) => ({
      label: item.displayName,
      onSelect: item.callback,
    })) ?? [],
  );

  // Handle backdrop clicks to close menu
  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      actionsDispatcher.hideContextMenu();
    }
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if contextMenuState?.isVisible}
  <!-- Backdrop to catch clicks outside menu -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-50" onclick={handleBackdropClick}>
    <!-- Position the menu at the click coordinates -->
    <div class="absolute" style:left="{contextMenuState.x}px" style:top="{contextMenuState.y}px">
      <div class="menu menu-sm bg-base-100 border-base-content/20 rounded-none border">
        {#each menuOptions as option}
          <div class="btn btn-sm btn-ghost rounded-none" onclick={option.onSelect}>
            {option.label}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

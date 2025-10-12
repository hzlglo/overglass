<script lang="ts">
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import Tooltip from '../core/Tooltip.svelte';
  import UsageAnalyticsCheckbox from './UsageAnalyticsCheckbox.svelte';
</script>

<div class="mt-4 flex flex-col items-start gap-8 p-4">
  <UsageAnalyticsCheckbox />
  <Tooltip contentString="This will clear all saved track names and colors">
    <button
      class="btn btn-sm btn-error w-fit self-start"
      onclick={() => {
        appConfigStore.clearAllCustomizations();
      }}
    >
      Reset all customizations
    </button>
  </Tooltip>
</div>

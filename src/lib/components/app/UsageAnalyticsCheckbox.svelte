<script lang="ts">
  import { enableUsageAnalyticsStore } from './enableUsageAnalytics.svelte';
</script>

<div class="flex flex-row gap-2">
  <input
    type="checkbox"
    checked={enableUsageAnalyticsStore.getEnableUsageAnalytics()}
    onchange={(event) =>
      enableUsageAnalyticsStore.setEnableUsageAnalytics((event.target as HTMLInputElement).checked)}
  />
  <p>Enable usage analytics to help make this app better</p>
</div>

<script lang="ts">
  import { goto } from '$app/navigation';
  import Debugger from '$lib/components/app/Debugger.svelte';
  import PageWrapper from '$lib/components/app/PageWrapper.svelte';
  import Tab from '$lib/components/core/Tab.svelte';
  import Tabs from '$lib/components/core/Tabs.svelte';
  import { ArrowLeftIcon } from '@lucide/svelte';
  import Settings from '$lib/components/app/Settings.svelte';
</script>

<PageWrapper>
  {#snippet navbarBackAction()}
    <button class="btn btn-ghost btn-sm" onclick={() => goto('/')}>
      <ArrowLeftIcon />
      Back
    </button>
  {/snippet}
  <Tabs
    options={[{ value: 'Settings' }, { value: 'Debugger' }]}
    value="Settings"
    class="min-h-0 overflow-y-auto"
  >
    <Tab value="Settings">
      <Settings />
    </Tab>
    <Tab value="Debugger">
      <Debugger />
    </Tab>
  </Tabs>
</PageWrapper>

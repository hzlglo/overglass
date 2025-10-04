<script lang="ts">
  import { goto } from '$app/navigation';
  import Debugger from '$lib/components/app/Debugger.svelte';
  import PageWrapper from '$lib/components/app/PageWrapper.svelte';
  import Tab from '$lib/components/core/Tab.svelte';
  import Tabs from '$lib/components/core/Tabs.svelte';
  import MidiMapping from '$lib/components/settings/MidiMapping.svelte';
  import { ArrowLeftIcon } from '@lucide/svelte';
</script>

<PageWrapper>
  {#snippet navbarBackAction()}
    <button class="btn btn-ghost btn-sm" onclick={() => goto('/')}>
      <ArrowLeftIcon />
      Back
    </button>
  {/snippet}
  <Tabs options={[{ value: 'Midi Mapping' }, { value: 'Debugger' }]} value="Midi Mapping">
    <Tab value="Debugger">
      <Debugger />
    </Tab>
    <Tab value="Midi Mapping">
      <MidiMapping />
    </Tab>
  </Tabs>
</PageWrapper>

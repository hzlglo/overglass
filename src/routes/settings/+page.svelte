<script lang="ts">
  import Debugger from '$lib/components/app/Debugger.svelte';
  import PageWrapper from '$lib/components/app/PageWrapper.svelte';
  import Tab from '$lib/components/core/Tab.svelte';
  import Tabs from '$lib/components/core/Tabs.svelte';
  import MidiMapping from '$lib/components/settings/MidiMapping.svelte';
</script>

<PageWrapper>
  <Tabs options={[{ value: 'Midi Mapping' }, { value: 'Debugger' }]}>
    <Tab value="Debugger">
      <Debugger />
    </Tab>
    <Tab value="Midi Mapping">
      <MidiMapping />
    </Tab>
  </Tabs>
</PageWrapper>

<script lang="ts">
  import type { Track } from '$lib/database/schema';
  import { automationDb } from '../stores/database.svelte';
  import AutomationParameter from './AutomationParameter.svelte';
  import { trackExpansionState } from './trackExpansionState.svelte';
  import TrackLane from './TrackLane.svelte';

  interface TrackProps {
    track: Track;
  }

  let { track }: TrackProps = $props();

  let isTrackExpanded = $derived(trackExpansionState.getTrackExpanded(track.id));

  let devicePromise = $derived(automationDb.get().devices.getDeviceById(track.deviceId));
  let parametersPromise = $derived(automationDb.get().tracks.getParametersForTrack(track.id));
</script>

{#await Promise.all([devicePromise, parametersPromise]) then [device, parameters]}
  <TrackLane
    title={track.trackName}
    isExpanded={isTrackExpanded}
    onToggleExpanded={() => trackExpansionState.toggleTrackExpansion(track.id)}
  >
    {#snippet body()}
      todo add body component
    {/snippet}
    {#snippet right()}{/snippet}
    {#snippet children()}
      {#each parameters as parameter}
        <AutomationParameter {parameter} />
      {/each}
    {/snippet}
  </TrackLane>
{/await}

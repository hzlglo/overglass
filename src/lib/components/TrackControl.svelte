<script lang="ts">
  import type { Track } from '$lib/database/schema';
  import { automationDb } from '../stores/database.svelte';
  import TrackParamControl from './TrackParamControl.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import LaneControl from './LaneControl.svelte';

  interface TrackProps {
    trackId: string;
  }

  let { trackId }: TrackProps = $props();
  let trackPromise: Promise<Track | null> = $derived(
    automationDb.get().tracks.getTrackById(trackId),
  );

  $inspect('trackId', trackId);

  let isTrackExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));

  let devicePromise = $derived(automationDb.get().devices.getTrackDevice(trackId));
  let parameterIds = $derived(gridDisplayState.getParameterOrder(trackId));
</script>

{#await Promise.all([trackPromise, devicePromise]) then [track, device]}
  {#if track}
    <LaneControl
      title={track.trackName}
      isExpanded={isTrackExpanded}
      onToggleExpanded={() => gridDisplayState.toggleTrackExpansion(trackId)}
      laneId={trackId}
    >
      {#each parameterIds as parameterId}
        <TrackParamControl {parameterId} />
      {/each}
    </LaneControl>
  {:else}
    <div class="text-error">Track not found</div>
  {/if}
{/await}

<script lang="ts">
  import type { TrackCustomization } from '$lib/stores/customization.svelte';
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
  import MuteTransitions from './MuteTransitions.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';

  interface MuteTransitionWrapperProps {
    trackId: string;
    height: number;
    width: number;
    yPosition: number;
    trackCustomizations: Record<string, TrackCustomization>;
  }

  let { trackId, height, width, yPosition, trackCustomizations }: MuteTransitionWrapperProps =
    $props();
  let trackStore = useTrackDbQuery((db) => db.tracks.getTrackById(trackId), null);
  let track = $derived(trackStore.getResult());
  let isExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));

  let muteTransitionsStore = useTrackDbQuery(
    (db) => db.muteTransitions.getMuteTransitionsForTrack(trackId),
    [],
  );
  let muteTransitions = $derived(muteTransitionsStore.getResult());
</script>

{#if track}
  {#if isExpanded}
    <MuteTransitions
      {trackId}
      {track}
      {height}
      {width}
      {yPosition}
      {muteTransitions}
      color={trackCustomizations[trackId]?.color}
    />
  {/if}
{:else}
  <g><text> {trackId} track not found</text></g>
{/if}

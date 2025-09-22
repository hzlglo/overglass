<script lang="ts">
  import type { TrackCustomization } from '$lib/stores/customization.svelte';
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
  import MuteClips from './MuteClips.svelte';
  import { gridDisplayState } from './gridDisplayState.svelte';
  import type { MuteTransition } from '$lib/database/schema';

  interface MuteTransitionWrapperProps {
    trackId: string;
    height: number;
    width: number;
    yPosition: number;
    trackCustomizations: Record<string, TrackCustomization>;
    muteTransitions: MuteTransition[];
  }

  let {
    trackId,
    height,
    width,
    yPosition,
    trackCustomizations,
    muteTransitions,
  }: MuteTransitionWrapperProps = $props();
  let trackStore = useTrackDbQuery((db) => db.tracks.getTrackById(trackId), null);
  let track = $derived(trackStore.getResult());
  let isExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));
</script>

{#if track}
  {#if isExpanded}
    <MuteClips
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

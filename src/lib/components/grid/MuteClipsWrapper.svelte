<script lang="ts">
  import type { MuteTransition } from '$lib/database/schema';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import MuteClips from './MuteClips.svelte';
  import { type TrackLaneDisplay } from './sharedGridState.svelte';

  interface MuteTransitionWrapperProps {
    lane: TrackLaneDisplay;
    width: number;
    muteTransitions: MuteTransition[];
  }

  let { lane, width, muteTransitions }: MuteTransitionWrapperProps = $props();

  let isExpanded = $derived(lane.expanded);
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[lane.track.id] ?? null);
</script>

{#if isExpanded && muteTransitions && muteTransitions.length > 0}
  <MuteClips
    trackId={lane.track.id}
    track={lane.track}
    height={lane.bottom - lane.top}
    {width}
    {muteTransitions}
    color={trackConfig?.color}
  />
{/if}

<script lang="ts">
  import type { Track } from '$lib/database/schema';
  import { automationDb } from '../../stores/database.svelte';
  import TrackParamControl from './TrackParamControl.svelte';
  import { gridDisplayState } from '../grid/gridDisplayState.svelte';
  import LaneControl from './LaneControl.svelte';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  import ColorChooser from '../colors/ColorChooser.svelte';
  import { getThemeColor } from '$lib/utils/utils';

  interface TrackProps {
    trackId: string;
  }

  let { trackId }: TrackProps = $props();
  let trackPromise: Promise<Track | null> = $derived(
    automationDb.get().tracks.getTrackById(trackId),
  );

  let isTrackExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));

  let devicePromise = $derived(automationDb.get().devices.getTrackDevice(trackId));
  let parameterIds = $derived(gridDisplayState.getParameterOrder()[trackId]);
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[trackId] ?? null);
</script>

{#await Promise.all([trackPromise, devicePromise]) then [track, device]}
  {#if track}
    <LaneControl
      title={trackConfig?.userEnteredName || track.trackName}
      onRename={(newTitle) => appConfigStore.setTrackName(track.id, newTitle)}
      class="font-bold"
      isExpanded={isTrackExpanded}
      onToggleExpanded={() => gridDisplayState.toggleTrackExpansion(trackId)}
      laneId={trackId}
      color={trackConfig?.color}
    >
      {#snippet actions()}
        <ColorChooser
          value={trackConfig?.color || getThemeColor('primary')}
          onValueChange={(color) => appConfigStore.setTrackColor(trackId, color)}
        />
      {/snippet}
      {#each parameterIds as parameterId}
        <TrackParamControl {parameterId} {trackConfig} />
      {/each}
    </LaneControl>
  {:else}
    <div class="text-error">Track not found</div>
  {/if}
{/await}

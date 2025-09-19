<script lang="ts">
  import { useTrackDbQuery } from '../../stores/trackDb.svelte';
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
  let trackStore = useTrackDbQuery((trackDb) => trackDb.tracks.getTrackById(trackId), null);
  let track = $derived(trackStore.getResult());

  let isTrackExpanded = $derived(gridDisplayState.getTrackExpanded(trackId));

  let deviceStore = useTrackDbQuery((trackDb) => trackDb.devices.getTrackDevice(trackId), null);
  let device = $derived(deviceStore.getResult());
  let parameterIds = $derived(gridDisplayState.getParameterOrder()[trackId]);
  let trackConfig = $derived(appConfigStore.get()?.trackCustomizations[trackId] ?? null);
</script>

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

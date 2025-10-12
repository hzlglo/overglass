<script lang="ts">
  import TrackControl from './TrackControl.svelte';
  import {
    BOTTOM_TIMELINE_HEIGHT,
    sharedGridState,
    TOP_TIMELINE_HEIGHT,
    type TrackLanesDisplay,
  } from '../grid/sharedGridState.svelte';
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import SizeObserver from '../core/SizeObserver.svelte';
  import { keyBy, uniq } from 'lodash';
  import { SearchIcon } from '@lucide/svelte';
  import TrackParamControl from './TrackParamControl.svelte';

  let { gridScroll = $bindable() }: { gridScroll: number } = $props();

  let trackLanesById: Record<string, TrackLanesDisplay> = $state({});
  let trackOrder: { id: string; name: string }[] = $state([]);
  $effect(() => {
    trackLanesById = keyBy(sharedGridState.getLanesByTrack(), (t: TrackLanesDisplay) => t.trackId);
    trackOrder = sharedGridState.getTrackOrder().map((id) => ({ id, name: id }));
  });

  let trackListContainer = $state<HTMLDivElement>();
  $effect(() => {
    if (!trackListContainer) return;
    trackListContainer.scrollTop = gridScroll;
  });
  $effect(() => {
    const syncScroll = () => {
      if (!trackListContainer) return;
      if (gridScroll === trackListContainer.scrollTop) return;
      gridScroll = trackListContainer.scrollTop;
    };
    trackListContainer?.addEventListener('scroll', syncScroll);
    return () => {
      trackListContainer?.removeEventListener('scroll', syncScroll);
    };
  });
  let height = $state(0);
  let width = $state(0);
  let laneSearch = $derived(sharedGridState.getLaneSearch());
  // Reference to the search input element
  let searchInput: HTMLInputElement | null = null;

  // Focus search input on Cmd+F (or Ctrl+F)
  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      if (
        (e.key === 'f' || e.key === 'F') &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        // Prevent browser's default find
        e.preventDefault();
        // Focus the search input
        searchInput?.focus();
        // Optionally select the text
        searchInput?.select();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  });
</script>

<div class="flex min-h-0 flex-col">
  <div style="height: {TOP_TIMELINE_HEIGHT}px" class="flex flex-row items-center gap-2 px-2">
    <label class="input input-sm w-[200px]">
      <SearchIcon class="size-3" />
      <input
        type="text"
        bind:this={searchInput}
        placeholder="⌘+F"
        value={laneSearch}
        oninput={(e) => sharedGridState.setLaneSearch(e.target.value)}
      />
    </label>
  </div>
  <SizeObserver bind:height bind:width>
    <div class="flex-1">
      <div
        class="overflow-y-scroll"
        style="height: {height}px"
        bind:this={trackListContainer}
        use:dndzone={{
          items: trackOrder,
          flipDurationMs: 150,
          dropFromOthersDisabled: true,
          // if we're searching, disable dragging because reordering a filtered list is confusing
          dragDisabled: !!laneSearch,
        }}
        onconsider={(e) => {
          trackOrder = e.detail.items;
        }}
        onfinalize={(e) => {
          sharedGridState.setTrackOrder(uniq(e.detail.items.map((t) => t.id)));
        }}
      >
        {#each trackOrder as track (track.id)}
          {@const trackLanes = trackLanesById[track.id]}
          <div
            class="min-h-0"
            data-is-dnd-shadow-item-hint={track[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
          >
            {#if trackLanes}
              {#if trackLanes.trackLane}
                <TrackControl trackId={track.id} />
              {:else}
                {#each trackLanes.parameterLanes as parameter (parameter.id)}
                  <TrackParamControl parameterId={parameter.id}></TrackParamControl>
                {/each}
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </SizeObserver>
  <div style="height: {BOTTOM_TIMELINE_HEIGHT}px"></div>
</div>

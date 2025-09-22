<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { clamp } from '$lib/utils/utils';
  import { sortBy, uniq } from 'lodash';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import type { Track, MuteTransition } from '$lib/database/schema';
  import { MuteTransitionService } from '$lib/database/services/muteTransitionService';

  interface AutomationMuteProps {
    trackId: string;
    track: Track;
    height: number;
    width: number;
    yPosition: number;
    muteTransitions: MuteTransition[];
    color: string | undefined;
  }

  let {
    trackId,
    track,
    height,
    width,
    yPosition,
    muteTransitions,
    color: colorProp,
  }: AutomationMuteProps = $props();

  // State
  let gElement = $state<SVGElement>();

  // Derived values
  const margin = { top: 10, right: 0, bottom: 10, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);

  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());

  let yScale = $derived(d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]));
  // scale used for dragging points
  let yDiffScale = $derived(
    d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, 0 - innerHeight]),
  );

  let svgGroup = $derived(gElement ? d3.select(gElement) : undefined);

  let color = $derived(colorProp ?? 'var(--color-secondary)');

  let clips = $derived(MuteTransitionService.deriveClipsFromTransitions(muteTransitions));

  let rectYPadding = 4;
  $effect(() => {
    if (!svgGroup) {
      return;
    }
    svgGroup
      .selectAll('.clip')
      .data(clips, (d) => d.id)
      .join(
        (enter) => enter.append('rect'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', 'clip')
      .attr('x', (d) => xScale(d.start))
      .attr('y', (d) => rectYPadding)
      .attr('width', (d) => xScale(d.end) - xScale(d.start))
      .attr('height', innerHeight - rectYPadding * 2)
      .attr('fill', color)
      .attr('fill-opacity', 0.6)
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('rx', 2);
  });

  let muteDragHandles = $derived.by(() => {
    if (!svgGroup) {
      return undefined;
    }
    const rects = svgGroup
      .selectAll('.mute-drag-handle')
      .data(muteTransitions, (d) => d.id)
      .join(
        (enter) => enter.append('rect'),
        (update) => update,
        (exit) => exit.remove(),
      );
    rects
      ?.attr('x', (d) => xScale(d.timePosition) - 2)
      .attr('y', (d) => 0)
      .attr('class', 'mute-drag-handle')
      .attr('width', 4)
      .attr('height', innerHeight)
      .attr('fill', color)
      .attr('fill-opacity', 1)
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('rx', 2)
      .style('cursor', 'grab');
    return rects;
  });

  $effect(() => {
    sharedDragSelect.registerDragHandler(trackId, () => {
      muteDragHandles?.attr('x', (d) => xScale(d.timePosition) - 2);
    });
  });

  let selectedMuteTransitions = $derived(sharedDragSelect.getSelectedMuteTransitions());

  let drag = $derived(
    d3
      .drag()
      .on(
        'start',
        (
          event: d3.D3DragEvent<SVGCircleElement, MuteTransition, SVGElement>,
          d: MuteTransition,
        ) => {
          if (!selectedMuteTransitions.find((p) => p.id === d.id)) {
            sharedDragSelect.clear();
            sharedDragSelect.setSelectedMuteTransitions([d]);
          }
        },
      )
      .on('drag', (event, d) => {
        sharedDragSelect.dragEvent({
          dx: event.dx,
          // don't submit y transitions from mute drag
          dy: 0,
          yDiffScale,
        });
      })
      .on('end', async (event, d) => {
        sharedDragSelect.dragEnd();
      }),
  );

  $effect(() => {
    muteDragHandles?.call(drag, []);
  });
</script>

<g
  id={`${trackId}-${track.trackName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
  {color}
></g>

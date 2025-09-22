<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import { clamp } from '$lib/utils/utils';
  import { sortBy, uniq } from 'lodash';
  import { trackDb } from '$lib/stores/trackDb.svelte';
  import type { Track, MuteTransition } from '$lib/database/schema';

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
      ?.attr('x', (d) => xScale(d.timePosition))
      .attr('y', (d) => 0)
      .attr('class', 'mute-drag-handle')
      .attr('width', 2)
      .attr('height', innerHeight)
      .attr('fill', color)
      .attr('fill-opacity', 1)
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('rx', 2);
    return rects;
  });

  let selectedPoints = $derived(sharedDragSelect.getSelectedPoints());
  let thisTrackSelectedPoints = $derived(selectedPoints.filter((p) => p.trackId === trackId));

  let drag = $derived(
    d3
      .drag()
      .on(
        'start',
        (
          event: d3.D3DragEvent<SVGCircleElement, MuteTransition, SVGElement>,
          d: MuteTransition,
        ) => {
          if (!selectedPoints.find((p) => p.id === d.id)) {
            sharedDragSelect.setBrushSelection(null);
            sharedDragSelect.setSelectedPoints([d]);
          }
        },
      )
      .on('drag', (event, d) => {
        sharedDragSelect.dragEvent(event, yDiffScale);
      })
      .on('end', async (event, d) => {
        await trackDb.get().automation.bulkSetAutomationPoints(selectedPoints);
        await trackDb.refreshData();
      }),
  );

  $effect(() => {
    muteDragHandles?.call(drag, []);
  });

  // // Draw selected points
  // let selectedPointsCircles = $derived.by(() => {
  //   // Add new points
  //   let circles = svgGroup
  //     ?.selectAll<SVGCircleElement, AutomationPoint>('.point.selected')
  //     .data(thisTrackSelectedPoints, (p) => p.id)
  //     .join(
  //       (enter) => enter.append('circle'),
  //       (update) => update,
  //       (exit) => exit.remove(),
  //     );

  //   circles
  //     ?.attr('cx', (d) => xScale(d.timePosition))
  //     .attr('cy', (d) => yScale(d.value))
  //     .attr('class', 'point selected')
  //     .attr('r', 3)
  //     .attr('fill', 'var(--color-base-content)')
  //     .attr('fill-opacity', 0.4)
  //     .attr('stroke', 'var(--color-base-content)')
  //     .attr('stroke-width', 1);
  //   return circles;
  // });
  // $effect(() => {
  //   selectedPointsCircles?.call(drag, []);
  // });
</script>

<g
  id={`${trackId}-${track.trackName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
  {color}
></g>

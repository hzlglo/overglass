<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';
  import { sharedDragSelect } from './sharedDragSelect.svelte';
  import type { Track, MuteTransition } from '$lib/database/schema';
  import { MuteTransitionService } from '$lib/database/services/muteTransitionService';
  import { actionsDispatcher } from './actionsDispatcher.svelte';
  import { compact, max } from 'lodash';

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

  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());

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

  // // Background rectangle to capture events
  // let backgroundRect = $derived.by(() => {
  //   if (!svgGroup) return undefined;

  //   svgGroup.selectAll('.background-rect').remove();
  //   return svgGroup
  //     .append('rect')
  //     .attr('class', 'background-rect')
  //     .attr('x', 0)
  //     .attr('y', 0)
  //     .attr('width', innerWidth)
  //     .attr('height', innerHeight)
  //     .attr('fill', 'transparent')
  //     .style('cursor', 'pointer');
  // });

  // // Add event listeners for track area (for adding clips)
  // $effect(() => {
  //   if (!backgroundRect) return;

  //   backgroundRect
  //     .on('dblclick', (event) => {
  //       const [mouseX] = d3.pointer(event);
  //       const timePosition = xScale.invert(mouseX);

  //       actionsDispatcher.handleDoubleClick(event, 'track', {
  //         trackId,
  //         timePosition,
  //         selectedMuteTransitions: selectedMuteTransitions,
  //       });
  //     })
  //     .on('contextmenu', (event) => {
  //       const [mouseX] = d3.pointer(event);
  //       const timePosition = xScale.invert(mouseX);

  //       actionsDispatcher.handleRightClick(event, 'track', {
  //         trackId,
  //         timePosition,
  //         selectedMuteTransitions: selectedMuteTransitions,
  //       });
  //     });
  // });

  let rectYPadding = 4;
  let clipRects = $derived.by(() => {
    if (!svgGroup) {
      return undefined;
    }
    const getClipStart = (dStart: number): number => max([xScale(dStart), 0]) ?? 0;
    return svgGroup
      .selectAll('.clip')
      .data(clips, (d) => d.id)
      .join(
        (enter) => enter.append('rect'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', 'clip')
      .attr('x', (d) => getClipStart(d.start))
      .attr('y', (d) => rectYPadding)
      .attr('width', (d) => xScale(d.end ?? xScale.domain()[1]) - getClipStart(d.start))
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
      .attr('y', 0)
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
      .on('drag', (event) => {
        sharedDragSelect.dragEvent({
          dx: event.dx,
          // don't submit y transitions from mute drag
          dy: 0,
          yDiffScale,
        });
      })
      .on('end', async () => {
        sharedDragSelect.dragEnd();
      }),
  );

  $effect(() => {
    muteDragHandles?.call(drag, []);
  });

  // Add event listeners for interactive actions on clip rectangles
  $effect(() => {
    if (!clipRects) return;

    // Add listeners to clip rectangles
    clipRects
      .on('dblclick', (event, d) => {
        // Double-click on clip deletes it
        const clipTransitions = compact([d.startTransition, d.endTransition]);
        actionsDispatcher.handleDoubleClick(event, 'track', {
          trackId,
          selectedMuteTransitions: clipTransitions,
          timePosition: xScale.invert(event.x),
        });
      })
      .on('contextmenu', (event, d) => {
        const clipTransitions = compact([d.startTransition, d.endTransition]);
        actionsDispatcher.handleRightClick(event, 'track', {
          trackId,
          selectedMuteTransitions: clipTransitions,
          timePosition: xScale.invert(event.x),
        });
      });

    // Add listeners to mute drag handles
    muteDragHandles?.on('contextmenu', (event, d) => {
      event.stopPropagation();
      actionsDispatcher.handleRightClick(event, 'track', {
        trackId,
        selectedMuteTransitions: selectedMuteTransitions.length > 0 ? selectedMuteTransitions : [d],
      });
    });
  });
</script>

<g
  id={`${trackId}-${track.trackName}`}
  bind:this={gElement}
  transform={`translate(0,${yPosition + margin.top})`}
  {width}
  {color}
></g>

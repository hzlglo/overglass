<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';
  import { playState } from '../play/playState.svelte';
  import { max } from 'lodash';

  let { height }: { height: number } = $props();

  let playPoint = $derived(playState.getPlayPoint());
  let xScale = $derived(sharedXScale.getZoomedXScale());

  let lineElt = $state<SVGLineElement>();
  let line = $derived(lineElt ? d3.select(lineElt) : undefined);

  let drag = $derived(
    d3.drag().on('drag', (event, d) => {
      const newPlayPoint = max([xScale.invert(event.x), 0]);
      playState.setPlayPoint(newPlayPoint);
    }),
  );

  $effect(() => {
    line?.call(drag, []);
  });
</script>

{#if playState.getHasClickedPlay()}
  <line
    x1={xScale(playPoint)}
    x2={xScale(playPoint)}
    y1={0}
    y2={height}
    stroke="currentColor"
    stroke-width={2}
    style="cursor: grab"
    bind:this={lineElt}
  />
{/if}

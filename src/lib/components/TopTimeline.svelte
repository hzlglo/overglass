<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';
  import TrackLane from './TrackLane.svelte';
  import SizeObserver from './SizeObserver.svelte';

  let svgElement = $state<SVGElement>();
  let svgGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();

  const margin = { top: 10, right: 0, bottom: 30, left: 0 };
  let width = $state(800);
  let height = $state(60);
  let innerWidth = $derived(width - margin.left - margin.right);
  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScaleBars = $derived(sharedXScale.getZoomedXScaleBars());
  $inspect('xScaleBars', xScaleBars.domain(), xScaleBars.range());
  let xAxisBars = $derived(sharedXScale.getXAxisBars());

  // Setup SVG
  $effect(() => {
    if (svgElement && !svgGroup) {
      const svg = d3.select(svgElement);
      svg.selectAll('*').remove();
      svgGroup = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    }
  });

  $effect(() => {
    let zoom = sharedXScale.getZoom();
    if (!svgGroup) {
      return;
    }
    svgGroup.call(zoom);
  });

  // Draw timeline
  $effect(() => {
    if (svgGroup && innerWidth > 0 && innerHeight > 0) {
      svgGroup.selectAll('*').remove();

      // Background
      svgGroup
        .append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('stroke-opacity', 0.1)
        .attr('fill', 'var(--color-base-100)');

      // Time axis
      svgGroup
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxisBars.tickSize(-innerHeight).tickFormat((s) => `${s}`))
        .selectAll('line')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);

      // Current playhead (placeholder)
      svgGroup
        .append('line')
        .attr('x1', xScaleBars(0))
        .attr('x2', xScaleBars(0))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke-width', 2)
        .attr('opacity', 0.8);
    }
  });
</script>

<TrackLane>
  {#snippet body()}
    <SizeObserver bind:width bind:height>
      <svg bind:this={svgElement} {width} {height} class="block"></svg>
    </SizeObserver>
  {/snippet}
  {#snippet right()}{/snippet}
  {#snippet children()}{/snippet}
</TrackLane>

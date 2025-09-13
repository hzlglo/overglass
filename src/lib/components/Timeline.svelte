<script lang="ts">
  import * as d3 from 'd3';
  import { sharedZoom } from './sharedZoom.svelte';

  let height = 60;

  interface TimelineProps {}

  let {}: TimelineProps = $props();

  let svgElement = $state<SVGElement>();
  let svgGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();

  const margin = { top: 10, right: 20, bottom: 30, left: 20 };
  let innerWidth = $derived(
    window?.innerWidth ? window.innerWidth - margin.left - margin.right - 40 : 800,
  );
  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(d3.scaleLinear().domain(sharedZoom.getZoomDomain()).range([0, innerWidth]));

  // Setup SVG
  $effect(() => {
    if (svgElement && !svgGroup) {
      const svg = d3.select(svgElement);
      svg.selectAll('*').remove();
      svgGroup = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    }
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
        .attr('fill', 'hsl(var(--b2))')
        .attr('stroke', 'hsl(var(--bc))')
        .attr('stroke-opacity', 0.1);

      // Time axis
      svgGroup
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(xScale)
            .tickFormat((d) => `${d}s`)
            .tickSize(-innerHeight)
            .ticks(5),
        )
        .style('color', 'hsl(var(--bc))')
        .selectAll('line')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);

      // Current playhead (placeholder)
      svgGroup
        .append('line')
        .attr('x1', xScale(0))
        .attr('x2', xScale(0))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'hsl(var(--p))')
        .attr('stroke-width', 2)
        .attr('opacity', 0.8);
    }
  });
</script>

<div class="timeline-container bg-base-200 border-base-content/10 border-t">
  <svg bind:this={svgElement} width={innerWidth + margin.left + margin.right} {height} class="block"
  ></svg>
</div>

<style>
  .timeline-container :global(.domain) {
    stroke: hsl(var(--bc));
    stroke-opacity: 0.5;
  }

  .timeline-container :global(.tick text) {
    fill: hsl(var(--bc));
    font-size: 11px;
  }
</style>

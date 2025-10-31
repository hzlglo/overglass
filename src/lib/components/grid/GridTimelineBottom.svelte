<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';

  let { width, height, y }: { width: number; height: number; y: number } = $props();

  let gElement = $state<SVGGElement>();
  let gGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();

  const margin = { top: 10, right: 0, bottom: 30, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);
  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xScale = $derived(sharedXScale.getZoomedXScale());

  // Setup g
  $effect(() => {
    if (gElement && !gGroup) {
      const g = d3.select(gElement);
      g.selectAll('*').remove();
      gGroup = g.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    }
  });

  // Draw timeline
  $effect(() => {
    if (gGroup && innerWidth > 0 && innerHeight > 0) {
      gGroup.selectAll('*').remove();

      // Background
      gGroup
        .append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('stroke-opacity', 0.1)
        .attr('fill', 'var(--color-base-100)');

      // Time axis
      gGroup
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(xScale)
            .tickFormat((d) => {
              // d is seconds, format as M:SS
              let totalSeconds = Math.floor(Number(d));
              let minutes = Math.floor(totalSeconds / 60);
              let seconds = totalSeconds % 60;
              return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            })
            .tickSize(-innerHeight)
            .ticks(5),
        )
        .selectAll('line')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);

      // Current playhead (placeholder)
      gGroup
        .append('line')
        .attr('x1', xScale(0))
        .attr('x2', xScale(0))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke-width', 2)
        .attr('opacity', 0.8);
    }
  });
</script>

<g
  bind:this={gElement}
  {width}
  {height}
  class="allow-pan block cursor-grab"
  transform={`translate(0,${y})`}
></g>

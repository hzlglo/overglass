<script lang="ts">
  import * as d3 from 'd3';
  import { sharedXScale } from './sharedXScale.svelte';

  let { width, height }: { width: number; height: number } = $props();

  let gElement = $state<SVGGElement>();
  let gGroup = $state<d3.Selection<SVGGElement, unknown, null, undefined>>();

  const margin = { top: 10, right: 0, bottom: 30, left: 0 };
  let innerWidth = $derived(width - margin.left - margin.right);
  let innerHeight = $derived(height - margin.top - margin.bottom);

  let xAxisBars = $derived(sharedXScale.getXAxisBars());

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
        .call(xAxisBars.tickSize(-innerHeight).tickFormat((s) => `${s}`))
        .selectAll('line')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    }
  });
</script>

<g bind:this={gElement} {width} {height} class="allow-pan block cursor-grab"></g>

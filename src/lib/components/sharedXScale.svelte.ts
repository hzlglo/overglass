import * as d3 from 'd3';

const getSharedXScale = () => {
  // the max time across all automation points, i.e. the length of the song
  let maxTime = $state(60);
  let innerWidth = $state(800);

  let xScale = $derived(d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]));
  let zoomedXScale = $state(xScale);

  let zoom = $derived(
    d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([1, 50]) // Allow up to 50x zoom
      // .translateExtent([
      //   [0, 0],
      //   [innerWidth, innerHeight],
      // ])
      .on('zoom', (event) => {
        // if (isZooming) return; // Prevent infinite loops
        // isZooming = true;
        console.log('zoom', event.transform);
        let currentZoomTransform = event.transform;
        console.log('currentZoomTransform', currentZoomTransform);
        zoomedXScale = currentZoomTransform.rescaleX(xScale);
        console.log('zoomedXScale', zoomedXScale.domain());
        // const newDomain = newXScale.domain();
        // sharedZoom.setZoomDomain([Math.max(0, newDomain[0]), Math.min(maxTime, newDomain[1])]);
        // setTimeout(() => {
        //   sharedZoom.setZooming(false);
        // }, 0); // Reset flag after current event loop
      }),
  );

  return {
    getZoom: () => zoom,
    getZoomedXScale: () => zoomedXScale,
    setMaxTime: (maxTimeInner: number) => {
      maxTime = maxTimeInner;
      console.log('setMaxTime', maxTime);
      zoomedXScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    },
    setWidth: (widthInner: number) => {
      innerWidth = widthInner;
      console.log('setWidth', innerWidth);
      zoomedXScale = d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]);
    },
  };
};

export const sharedXScale = getSharedXScale();

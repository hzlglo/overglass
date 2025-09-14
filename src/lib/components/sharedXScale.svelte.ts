import * as d3 from 'd3';

const getSharedXScale = () => {
  // the max time across all automation points, i.e. the length of the song
  let maxTime = $state(60);
  let innerWidth = $state(800);

  let xScale = $derived(d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]));
  let zoomedXScale = $state(xScale);

  let lastZoomEvent = $state(null);

  let zoom = $derived(
    d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([1, 50]) // Allow up to 50x zoom
      .on('zoom', (event) => {
        console.log('this', this);
        lastZoomEvent = event;
        const currentZoomTransform = event.transform;
        zoomedXScale = currentZoomTransform.rescaleX(xScale);
      }),
  );

  return {
    getZoom: () => zoom,
    getZoomedXScale: () => zoomedXScale,
    getLastZoomEvent: () => lastZoomEvent,
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

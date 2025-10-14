import * as d3 from 'd3';
import { secondsToBars } from '../../utils/timeConversion';
import { appStore } from '$lib/stores/app.svelte';
function nextPowerOfTwo(n: number) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}
function previousPowerOfTwo(n: number) {
  return Math.pow(2, Math.floor(Math.log2(n)));
}
function getTicksForBarSpan0Indexed(minBar: number, maxBar: number, roughTickTarget: number = 16) {
  // Generate ticks at base-2 intervals (e.g., 0.5, 1, 2, 4, 8, 16, ...)
  // Try to get ~8-12 ticks within the span
  // subtract 1 from both since the bars are 1-indexed
  const distanceBetweenTicks = previousPowerOfTwo(maxBar - minBar) / roughTickTarget;
  let firstTick = minBar;
  if (minBar % distanceBetweenTicks !== 0) {
    firstTick = minBar - (minBar % distanceBetweenTicks) + distanceBetweenTicks;
  }
  let lastTick = maxBar;
  if (maxBar % distanceBetweenTicks !== 0) {
    lastTick = maxBar - (maxBar % distanceBetweenTicks);
  }
  const result = [];
  for (let i = firstTick; i <= lastTick; i += distanceBetweenTicks) {
    result.push(i);
  }
  return result;
}
// translate to 1-indexed bars
function getTicksForBarSpan(minBar: number, maxBar: number, roughTickTarget: number = 16) {
  return getTicksForBarSpan0Indexed(minBar - 1, maxBar - 1, roughTickTarget).map((t) => t + 1);
}

const getSharedXScale = () => {
  // the max time across all automation points, i.e. the length of the song
  let maxTime = $state(60);
  let width = $state(800);

  let bpm = $derived(appStore.getFileMetadata()?.bpm || 120);
  let timeSigNumerator = $derived(appStore.getFileMetadata()?.meter.numerator || 4);
  let timeSigDenominator = $derived(appStore.getFileMetadata()?.meter.denominator || 4);

  let totalBars = $derived(secondsToBars(maxTime, bpm, timeSigNumerator, timeSigDenominator));

  let xScale = $derived(
    d3.scaleLinear().domain([0, maxTime]).range([0, width]),
    // .clamp(true)
  );
  let xScaleBars = $derived(
    d3
      .scaleLinear()
      .domain([1, totalBars.barFractional])
      // same pixel mapping as xScale
      .range(xScale.range()),
  );

  let lastZoomEvent = $state(null);
  let currentZoomTransform = $state<d3.ZoomTransform | null>(null);

  let zoomedXScale = $derived(
    currentZoomTransform ? currentZoomTransform.rescaleX(xScale) : xScale,
  );
  let zoomedXScaleBars = $derived(
    currentZoomTransform ? currentZoomTransform.rescaleX(xScaleBars) : xScaleBars,
  );

  // let loopLength = $state(4);
  // TODO currently this is just providing some extra emphasis on every couple ticks. but originally
  // wanted this to be show the length of loops. consider re-adding loop ticks if it seems important.
  let loopTicks = $derived(
    getTicksForBarSpan(zoomedXScaleBars.domain()[0], zoomedXScaleBars.domain()[1], 2),
  );

  let snapPointToGrid = $derived((timePosition: number) => {
    const [minBar, maxBar] = zoomedXScaleBars.domain();
    const roughGranularityTarget = 64;
    const nearestPowerOfTwo = previousPowerOfTwo(maxBar - minBar) / roughGranularityTarget;
    // add 1 since the bars are 1-indexed
    return 1 + Math.round((timePosition - 1) / nearestPowerOfTwo) * nearestPowerOfTwo;
  });

  let xAxisBars = $derived(
    d3
      .axisTop(zoomedXScaleBars)
      .tickFormat((d) => `${d}`)
      .tickValues(getTicksForBarSpan(zoomedXScaleBars.domain()[0], zoomedXScaleBars.domain()[1])),
  );

  let zoom = $derived(
    d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([1, 200]) // Allow up to 50x zoom
      .translateExtent([
        [0, 0],
        [width, Infinity],
      ])
      .filter((event, d) => {
        // prevent zooming with the scroll wheel, and prevent panning via drag
        const allowPan = event.target.closest('g.allow-pan') != null;
        const result =
          !(!event.ctrlKey && event.type === 'wheel' && !event.metaKey && !event.ctrlKey) &&
          (event.type !== 'mousedown' || allowPan) &&
          event.type !== 'dblclick';
        return result;
      })
      .on('zoom', (event) => {
        lastZoomEvent = event;
        currentZoomTransform = event.transform;
      }),
  );
  let getDataDeltaForScreenDelta = $derived((screenDelta: number) => {
    if (!currentZoomTransform) return xScale.invert(screenDelta);
    return (
      ((screenDelta / currentZoomTransform.k) * (xScale.domain()[1] - xScale.domain()[0])) /
      (xScale.range()[1] - xScale.range()[0])
    );
  });

  return {
    getDataDeltaForScreenDelta: getDataDeltaForScreenDelta,
    getZoom: () => zoom,
    getZoomedXScale: () => zoomedXScale,
    getLastZoomEvent: () => lastZoomEvent,
    getZoomedXScaleBars: () => zoomedXScaleBars,
    getXAxisBars: () => xAxisBars,
    getLoopTicks: () => loopTicks,
    getSnapPointToGrid: () => snapPointToGrid,
    getCurrentZoomTransform: () => currentZoomTransform,
    // getLoopLength: () => loopLength,
    // setLoopLength: (loopLengthInner: number) => {
    //   loopLength = loopLengthInner;
    // },
    setMaxTime: (maxTimeInner: number) => {
      maxTime = maxTimeInner;
    },
    setWidth: (widthInner: number) => {
      width = widthInner;
      zoomedXScale = d3.scaleLinear().domain([0, maxTime]).range([0, width]);
    },
    setBpm: (bpmInner: number) => {
      bpm = bpmInner;
    },
    getTimeSignature: () => {
      return { numerator: timeSigNumerator, denominator: timeSigDenominator };
    },
    setTimeSignature: (timeSigNumeratorInner: number, timeSigDenominatorInner: number) => {
      timeSigNumerator = timeSigNumeratorInner;
      timeSigDenominator = timeSigDenominatorInner;
    },
    getMaxTime: () => maxTime,
  };
};

export const sharedXScale = getSharedXScale();

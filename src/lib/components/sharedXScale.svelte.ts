import * as d3 from 'd3';
function nextPowerOfTwo(n: number) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}
function previousPowerOfTwo(n: number) {
  return Math.pow(2, Math.floor(Math.log2(n)));
}
export function getTicksForBarSpan(minBar: number, maxBar: number) {
  // Generate ticks at base-2 intervals (e.g., 0.5, 1, 2, 4, 8, 16, ...)
  // Try to get ~8-12 ticks within the span
  // subtract 1 from both since the bars are 1-indexed
  const distanceBetweenTicks = previousPowerOfTwo(maxBar - minBar) / 8;
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
    result.push(
      // add 1 since the bars are 1-indexed
      i,
    );
  }
  return result;
}

export function secondsToBars(
  timeInSeconds: number,
  bpm: number,
  timeSigNumerator: number,
  timeSigDenominator: number,
) {
  const bps = bpm / 60;
  const beatLength = 4 / timeSigDenominator; // quarter = 1, eighth = 0.5, half = 2
  const effectiveBPS = bps * beatLength;

  const totalBeats = timeInSeconds * effectiveBPS;

  const beatsPerBar = timeSigNumerator;
  const totalBars = Math.floor(totalBeats / beatsPerBar);
  const barNumber = totalBars + 1;

  const beatInBar = (totalBeats % beatsPerBar) + 1;

  const barFractional = barNumber + beatInBar / beatsPerBar;

  return { bar: barNumber, beat: beatInBar, barFractional };
}

const getSharedXScale = () => {
  // the max time across all automation points, i.e. the length of the song
  let maxTime = $state(60);
  let innerWidth = $state(800);

  let bpm = $state(120);
  let timeSigNumerator = $state(4);
  let timeSigDenominator = $state(4);

  let totalBars = $derived(secondsToBars(maxTime, bpm, timeSigNumerator, timeSigDenominator));

  let xScale = $derived(d3.scaleLinear().domain([0, maxTime]).range([0, innerWidth]).clamp(true));
  let xScaleBars = $derived(
    d3
      .scaleLinear()
      .domain([1, totalBars.barFractional])
      // same pixel mapping as xScale
      .range(xScale.range()),
  );
  let zoomedXScale = $state(xScale);
  let zoomedXScaleBars = $state(xScaleBars);

  let xAxisBars = $state(d3.axisTop(xScaleBars).tickFormat((d) => `${d}`));

  let lastZoomEvent = $state(null);

  let zoom = $derived(
    d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([1, 200]) // Allow up to 50x zoom
      .translateExtent([
        [0, 0],
        [Infinity, Infinity],
      ])
      .filter((event) => {
        // prevent zooming with the scroll wheel
        console.log('event', event);
        return !(!event.ctrlKey && event.type === 'wheel');
      })
      .on('zoom', (event) => {
        lastZoomEvent = event;
        const currentZoomTransform = event.transform;
        zoomedXScale = currentZoomTransform.rescaleX(xScale);
        zoomedXScaleBars = currentZoomTransform.rescaleX(xScaleBars);
        xAxisBars = d3
          .axisTop(zoomedXScaleBars)
          .tickFormat((d) => `${d}`)
          .tickValues(
            getTicksForBarSpan(zoomedXScaleBars.domain()[0], zoomedXScaleBars.domain()[1]),
          );
      }),
  );

  return {
    getZoom: () => zoom,
    getZoomedXScale: () => zoomedXScale,
    getLastZoomEvent: () => lastZoomEvent,
    getZoomedXScaleBars: () => zoomedXScaleBars,
    getXAxisBars: () => xAxisBars,
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
    setBpm: (bpmInner: number) => {
      bpm = bpmInner;
    },
    setTimeSignature: (timeSigNumeratorInner: number, timeSigDenominatorInner: number) => {
      timeSigNumerator = timeSigNumeratorInner;
      timeSigDenominator = timeSigDenominatorInner;
    },
  };
};

export const sharedXScale = getSharedXScale();

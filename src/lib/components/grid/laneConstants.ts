import * as d3 from 'd3';

export const getAutomationLaneYAxis = (height: number, offsetY: number = 0) => {
  const margin = { top: 1, right: 0, bottom: 1, left: 0 };
  let innerHeight = height - margin.top - margin.bottom;
  let yScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([innerHeight + offsetY, offsetY]);
  return { innerHeight, yScale, margin };
};

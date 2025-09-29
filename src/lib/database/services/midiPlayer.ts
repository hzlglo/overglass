import { round } from 'lodash';
import type { AutomationDatabase } from '../duckdb';

export class MidiPlayer {
  constructor(private db: AutomationDatabase) {
    this.db = db;
  }

  async getMuteTransitionsToPlay(
    trackId: string,
    startTime: number,
    endTime: number,
    isBeginningPlay: boolean,
  ): Promise<{ timePosition: number; isMuted: boolean }[]> {
    const [rangeTransitions, prevTransitions] = await Promise.all([
      this.db.muteTransitions.getMuteTransitions({ trackId, startTime, endTime }),
      this.db.muteTransitions.getMuteTransitions({
        trackId,
        endTime: startTime,
        direction: 'desc',
        limit: 1,
      }),
    ]);
    const result = [];
    if (isBeginningPlay) {
      result.push(
        ...prevTransitions.map((t) => ({ ...t, timePosition: startTime })),
        ...rangeTransitions,
      );
    } else {
      result.push(...rangeTransitions);
    }
    return result.map((t) => ({ timePosition: t.timePosition, isMuted: t.isMuted }));
  }

  async getInterpolatedValuesToPlay({
    parameterId,
    startTime,
    endTime,
    granularity = 0.01,
    isBeginningPlay = false,
  }: {
    parameterId: string;
    startTime: number;
    endTime: number;
    granularity?: number;
    // if this is the initial play, we should include the current states of all parameters
    // otherwise, we should only include changed parameter states
    isBeginningPlay?: boolean;
  }): Promise<{ timePosition: number; value: number }[]> {
    const [rangePoints, prevPoints, nextPoints] = await Promise.all([
      this.db.automation.getAutomationPoints({ parameterId, startTime, endTime, direction: 'asc' }),
      this.db.automation.getAutomationPoints({
        parameterId,
        endTime: startTime,
        direction: 'desc',
        limit: 1,
      }),
      this.db.automation.getAutomationPoints({
        parameterId,
        startTime: endTime,
        direction: 'asc',
        limit: 1,
      }),
    ]);

    // Combine points efficiently since they're already sorted by database
    const points = [...prevPoints, ...rangePoints, ...nextPoints];

    if (points.length === 0) {
      return [];
    }

    // Check if automation is flat (all points have same value)
    const hasValueChange = points.some((point) => point.value !== points[0].value);

    if (!hasValueChange) {
      // Flat automation case
      if (isBeginningPlay) {
        return [{ timePosition: startTime, value: points[0].value }];
      } else {
        return [];
      }
    }

    // For changing automation, interpolate values
    const messages = [];
    let currentIndex = 0;
    let prevEmittedValue = null;
    let firstEmitted = false;

    // Single pass through time samples
    for (let t = startTime; t <= endTime; t += granularity) {
      // Advance point index to find bracketing pair
      while (currentIndex < points.length - 1 && points[currentIndex + 1].timePosition <= t) {
        currentIndex++;
      }

      const p1 = points[currentIndex];
      const p2 = points[currentIndex + 1];

      // Interpolate value at time t
      let value;
      if (!p2 || t <= p1.timePosition) {
        value = p1.value;
      } else {
        const alpha = (t - p1.timePosition) / (p2.timePosition - p1.timePosition);
        value = p1.value + alpha * (p2.value - p1.value);
      }

      // Round for comparison (keep precision for output)
      const roundedValue = Math.round(value * 1000) / 1000;

      // Emit logic: first emission or value change
      if (!firstEmitted) {
        if (isBeginningPlay) {
          messages.push({ timePosition: round(t, 3), value: roundedValue });
          prevEmittedValue = roundedValue;
          firstEmitted = true;
        } else {
          // For non-beginning play, emit if it's the first sample or if value changes
          if (prevEmittedValue === null) {
            // First sample - emit only if value is changing within the time range
            // Check if the value at the start differs from values later in the range
            const hasValueChangeInRange =
              rangePoints.length === 0 && prevPoints.length > 0 && nextPoints.length > 0;
            if (hasValueChangeInRange) {
              messages.push({ timePosition: round(t, 3), value: roundedValue });
              firstEmitted = true;
            }
            prevEmittedValue = roundedValue;
          } else if (roundedValue !== prevEmittedValue) {
            messages.push({ timePosition: round(t, 3), value: roundedValue });
            prevEmittedValue = roundedValue;
            firstEmitted = true;
          }
        }
      } else if (roundedValue !== prevEmittedValue) {
        messages.push({ timePosition: round(t, 3), value: roundedValue });
        prevEmittedValue = roundedValue;
      }
    }

    return messages;
  }
}

import { describe, it, expect } from 'vitest';
import { secondsToBars } from '../lib/components/grid/sharedXScale.svelte';

describe('secondsToBars', () => {
  describe('4/4 120 BPM', () => {
    const bpm = 120;
    const timeSigNumerator = 4;
    const timeSigDenominator = 4;

    it('should convert 0 seconds to bar 1, beat 1', () => {
      const result = secondsToBars(0, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 1 });
    });

    it('should convert 0.5 seconds to bar 1, beat 2', () => {
      const result = secondsToBars(0.5, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 2 });
    });

    it('should convert 1 second to bar 1, beat 3', () => {
      const result = secondsToBars(1, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 3 });
    });

    it('should convert 2 seconds (1 complete bar) to bar 2, beat 1', () => {
      const result = secondsToBars(2, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 2, beat: 1 });
    });

    it('should convert 4 seconds (2 complete bars) to bar 3, beat 1', () => {
      const result = secondsToBars(4, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 3, beat: 1 });
    });

    it('should convert 4.5 seconds to bar 3, beat 2', () => {
      const result = secondsToBars(4.5, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 3, beat: 2 });
    });
  });

  describe('6/8 140 BPM', () => {
    const bpm = 140;
    const timeSigNumerator = 6;
    const timeSigDenominator = 8;

    it('should convert 0 seconds to bar 1, beat 1', () => {
      const result = secondsToBars(0, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 1 });
    });

    it('should handle eighth note beats - 1 second should be within bar 1', () => {
      const result = secondsToBars(1, bpm, timeSigNumerator, timeSigDenominator);
      expect(result.bar).toBe(1);
      expect(result.beat).toBeGreaterThan(1);
      expect(result.beat).toBeLessThanOrEqual(7); // 6 beats + 1
    });

    it('should convert a complete bar duration to bar 2, beat 1', () => {
      // In 6/8 at 140 BPM: 6 eighth notes per bar
      // BPS = 140/60 = 2.333... beats per second
      // Beat length = 4/8 = 0.5 (eighth notes)
      // Effective BPS = 2.333... * 0.5 = 1.166... eighth notes per second
      // Time for 6 eighth notes = 6 / 1.166... ≈ 5.14 seconds
      const barDurationSeconds = 6 / ((140 / 60) * (4 / 8));
      const result = secondsToBars(barDurationSeconds, bpm, timeSigNumerator, timeSigDenominator);
      expect(result.bar).toBe(2);
      expect(result.beat).toBeCloseTo(1, 1);
    });
  });

  describe('4/4 180 BPM', () => {
    const bpm = 180;
    const timeSigNumerator = 4;
    const timeSigDenominator = 4;

    it('should convert 0 seconds to bar 1, beat 1', () => {
      const result = secondsToBars(0, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 1 });
    });

    it('should handle faster tempo - 1 second should be in bar 1, beat 4', () => {
      // At 180 BPM: 3 beats per second, so 1 second = 3 beats
      const result = secondsToBars(1, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 4 });
    });

    it('should convert to bar 2 after complete bar duration', () => {
      // 4 beats at 180 BPM = 4/3 seconds = 1.333... seconds
      const barDurationSeconds = 4 / (180 / 60);
      const result = secondsToBars(
        barDurationSeconds + 0.01,
        bpm,
        timeSigNumerator,
        timeSigDenominator,
      );
      expect(result.bar).toBe(2);
    });

    it('should convert 2 seconds to bar 2, beat 2', () => {
      // 2 seconds * 3 BPS = 6 beats = 1 bar + 2 beats
      const result = secondsToBars(2, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 2, beat: 3 }); // 6 beats = bar 1 (4 beats) + 2 beats in bar 2
    });
  });

  describe('3/4 160 BPM', () => {
    const bpm = 160;
    const timeSigNumerator = 3;
    const timeSigDenominator = 4;

    it('should convert 0 seconds to bar 1, beat 1', () => {
      const result = secondsToBars(0, bpm, timeSigNumerator, timeSigDenominator);
      expect(result).toEqual({ bar: 1, beat: 1 });
    });

    it('should handle 3/4 time signature - 1 second should be bar 1, beat ~3.67', () => {
      // At 160 BPM: 160/60 = 2.666... BPS
      // 1 second = 2.666... beats
      const result = secondsToBars(1, bpm, timeSigNumerator, timeSigDenominator);
      expect(result.bar).toBe(1);
      expect(result.beat).toBeCloseTo(3.67, 1);
    });

    it('should convert to bar 2 after 3 beats', () => {
      // 3 beats at 160 BPM = 3/(160/60) = 1.125 seconds
      const barDurationSeconds = 3 / (160 / 60);
      const result = secondsToBars(
        barDurationSeconds + 0.01,
        bpm,
        timeSigNumerator,
        timeSigDenominator,
      );
      expect(result.bar).toBe(2);
    });

    it('should convert 2 seconds to bar 2, beat ~2.33', () => {
      // 2 seconds * (160/60) BPS = 5.333... beats
      // 5.333... beats = 1 bar (3 beats) + 2.333... beats in bar 2
      const result = secondsToBars(2, bpm, timeSigNumerator, timeSigDenominator);
      expect(result.bar).toBe(2);
      expect(result.beat).toBeCloseTo(3.33, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle very small time values', () => {
      const result = secondsToBars(0.001, 120, 4, 4);
      expect(result.bar).toBe(1);
      expect(result.beat).toBeGreaterThan(1);
      expect(result.beat).toBeLessThan(2);
    });

    it('should handle large time values', () => {
      const result = secondsToBars(1000, 120, 4, 4);
      expect(result.bar).toBeGreaterThan(1);
      expect(result.beat).toBeGreaterThanOrEqual(1);
      expect(result.beat).toBeLessThanOrEqual(5); // beat should be 1-4 + 1
    });

    it('should handle different time signature denominators', () => {
      // 4/2 time (half note beats) - each beat is twice as long as quarter notes
      // At 120 BPM with half note beats: effective BPS = (120/60) * (4/2) = 4 BPS
      // 1 second = 4 beats, so we'd be at beat 5, which means bar 2, beat 1
      const result = secondsToBars(1, 120, 4, 2);
      expect(result.bar).toBe(2);
      expect(result.beat).toBeCloseTo(1, 1);
    });

    it('should return consistent results for the same input', () => {
      const result1 = secondsToBars(5.5, 140, 6, 8);
      const result2 = secondsToBars(5.5, 140, 6, 8);
      expect(result1).toEqual(result2);
    });
  });

  describe('mathematical accuracy', () => {
    it('should correctly calculate beats per second', () => {
      // 120 BPM = 2 BPS for quarter notes
      // 4/4 time with quarter note denominator
      const result = secondsToBars(0.5, 120, 4, 4); // 0.5 seconds = 1 beat
      expect(result).toEqual({ bar: 1, beat: 2 });
    });

    it('should correctly handle different note values in denominator', () => {
      // 4/8 time (eighth note beats) vs 4/4 time (quarter note beats)
      const result8th = secondsToBars(1, 120, 4, 8); // Eighth note beats
      const result4th = secondsToBars(1, 120, 4, 4); // Quarter note beats

      // For 4/8 time: effective BPS = (120/60) * (4/8) = 1 BPS, so 1 second = 1 beat -> bar 1, beat 2
      // For 4/4 time: effective BPS = (120/60) * (4/4) = 2 BPS, so 1 second = 2 beats -> bar 1, beat 3
      expect(result8th.beat).toBeLessThan(result4th.beat); // 8th note beats progress slower
      expect(result8th).toEqual({ bar: 1, beat: 2 });
      expect(result4th).toEqual({ bar: 1, beat: 3 });
    });
  });
});

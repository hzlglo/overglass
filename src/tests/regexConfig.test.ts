import { describe, it, expect } from 'vitest';
import { RegexMatcher, DEFAULT_ELEKTRON_REGEX, createRegexConfig } from '../lib/config/regex';

describe('Regex Configuration', () => {
  const matcher = new RegexMatcher(DEFAULT_ELEKTRON_REGEX);

  describe('Track Number Extraction', () => {
    it('should extract track numbers from Elektron parameter names', () => {
      expect(matcher.extractTrackNumber('T1 Filter Cutoff')).toBe(1);
      expect(matcher.extractTrackNumber('T5 Reverb Send')).toBe(5);
      expect(matcher.extractTrackNumber('T11 LFO Speed')).toBe(11);
      expect(matcher.extractTrackNumber('T16 Sample Pitch')).toBe(16);
    });

    it('should handle parameter names without track numbers', () => {
      expect(matcher.extractTrackNumber('Master Volume')).toBeNull();
      expect(matcher.extractTrackNumber('Global BPM')).toBeNull();
      expect(matcher.extractTrackNumber('Filter Cutoff')).toBeNull();
    });

    it('should handle malformed parameter names', () => {
      expect(matcher.extractTrackNumber('T Filter Cutoff')).toBeNull();
      expect(matcher.extractTrackNumber('TX Filter Cutoff')).toBeNull();
      expect(matcher.extractTrackNumber('')).toBeNull();
    });
  });

  describe('Mute Parameter Detection', () => {
    it('should identify mute parameters', () => {
      const result1 = matcher.parseMuteParameter('T1 Muted');
      expect(result1.isMute).toBe(true);
      expect(result1.trackNumber).toBe(1);

      const result2 = matcher.parseMuteParameter('T8 Mute');
      expect(result2.isMute).toBe(true);
      expect(result2.trackNumber).toBe(8);

      const result3 = matcher.parseMuteParameter('T5 MuteLevel');
      expect(result3.isMute).toBe(true);
      expect(result3.trackNumber).toBe(5);
    });

    it('should handle case insensitive mute detection', () => {
      const result1 = matcher.parseMuteParameter('T1 MUTED');
      expect(result1.isMute).toBe(true);
      expect(result1.trackNumber).toBe(1);

      const result2 = matcher.parseMuteParameter('T5 mute');
      expect(result2.isMute).toBe(true);
      expect(result2.trackNumber).toBe(5);
    });

    it('should not identify non-mute parameters', () => {
      const result1 = matcher.parseMuteParameter('T1 Filter Cutoff');
      expect(result1.isMute).toBe(false);
      expect(result1.trackNumber).toBeNull();

      const result2 = matcher.parseMuteParameter('T5 Volume');
      expect(result2.isMute).toBe(false);
      expect(result2.trackNumber).toBeNull();
    });
  });

  describe('Parameter Name Cleaning', () => {
    it('should clean parameter names by removing track prefix', () => {
      expect(matcher.cleanParameterName('T1 Filter Cutoff')).toBe('Filter Cutoff');
      expect(matcher.cleanParameterName('T11 Reverb Send A')).toBe('Reverb Send A');
      expect(matcher.cleanParameterName('T5 LFO Speed')).toBe('LFO Speed');
    });

    it('should handle parameter names without track prefix', () => {
      expect(matcher.cleanParameterName('Master Volume')).toBe('Master Volume');
      expect(matcher.cleanParameterName('Global BPM')).toBe('Global BPM');
    });
  });

  describe('Device Name Matching', () => {
    it('should match Elektron device names', () => {
      expect(matcher.matchDeviceName('1-Digitakt II')).toBe('digitakt');
      expect(matcher.matchDeviceName('Track 5 - Digitone Keys')).toBe('digitone');
      expect(matcher.matchDeviceName('Analog Four MKII')).toBe('analog');
      expect(matcher.matchDeviceName('Octatrack')).toBe('octatrack');
    });

    it('should handle case insensitive matching', () => {
      expect(matcher.matchDeviceName('DIGITAKT II')).toBe('digitakt');
      expect(matcher.matchDeviceName('digitone keys')).toBe('digitone');
    });

    it('should not match non-Elektron devices', () => {
      expect(matcher.matchDeviceName('Ableton Push')).toBeNull();
      expect(matcher.matchDeviceName('Roland TR-808')).toBeNull();
      expect(matcher.matchDeviceName('Random Track Name')).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    const testParameterNames = [
      'T1 Filter Cutoff',
      'T1 Reverb Send',
      'T1 Muted',
      'T5 LFO Speed',
      'T5 Volume',
      'T11 Sample Pitch',
      'Master Volume',
      'Global BPM',
    ];

    it('should get all referenced track numbers', () => {
      const trackNumbers = matcher.getAllTrackNumbers(testParameterNames);
      expect(trackNumbers).toEqual([1, 5, 11]);
    });

    it('should group parameters by track', () => {
      const grouped = matcher.groupParametersByTrack(testParameterNames);

      expect(grouped.get(1)).toEqual(['T1 Filter Cutoff', 'T1 Reverb Send', 'T1 Muted']);
      expect(grouped.get(5)).toEqual(['T5 LFO Speed', 'T5 Volume']);
      expect(grouped.get(11)).toEqual(['T11 Sample Pitch']);
      expect(grouped.has(99)).toBe(false);
    });
  });

  describe('Configuration Factory', () => {
    it('should create elektron config', () => {
      const config = createRegexConfig('elektron');
      const matcher = new RegexMatcher(config);

      expect(matcher.extractTrackNumber('T1 Filter Cutoff')).toBe(1);
      expect(matcher.parseMuteParameter('T5 Muted').isMute).toBe(true);
    });

    it('should create custom config', () => {
      const config = createRegexConfig('custom', {
        trackNumberPattern: /Track(\d+)/,
        muteParameterPattern: /Track(\d+)_Mute/,
      });
      const matcher = new RegexMatcher(config);

      expect(matcher.extractTrackNumber('Track5 Volume')).toBe(5);
      expect(matcher.parseMuteParameter('Track3_Mute').isMute).toBe(true);
    });

    it('should merge custom config with defaults for elektron', () => {
      const config = createRegexConfig('elektron', {
        deviceNamePattern: /(custom|device)/i,
      });
      const matcher = new RegexMatcher(config);

      // Should still work with elektron patterns
      expect(matcher.extractTrackNumber('T1 Filter Cutoff')).toBe(1);
      // But use custom device pattern
      expect(matcher.matchDeviceName('Custom Device')).toBe('custom');
    });
  });
});

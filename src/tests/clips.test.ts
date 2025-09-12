import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import type { ComputedClip } from '../lib/database/schema';

describe('Clip Detection', () => {
  let db: AutomationDatabase;

  beforeEach(async () => {
    // Create in-memory database for testing
    const adapter = new NativeDuckDBAdapter(':memory:');
    db = new AutomationDatabase(adapter);
    await db.initialize();

    // Create test data
    await db.run(`
      INSERT INTO devices (device_id, device_name, device_type, created_at)
      VALUES ('device-1', 'Digitakt II', 'elektron', '2024-01-01')
    `);

    await db.run(`
      INSERT INTO tracks (track_id, device_id, track_number, track_name, is_muted, created_at)
      VALUES ('track-1', 'device-1', 1, 'Track 1', false, '2024-01-01')
    `);

    await db.run(`
      INSERT INTO parameters (parameter_id, track_id, parameter_name, parameter_path, created_at)
      VALUES ('param-mute', 'track-1', 'T1 Muted', '/path/to/mute', '2024-01-01')
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Basic Clip Detection', () => {
    it('should detect single unmuted clip', async () => {
      // Create mute automation: unmuted from 0-10, muted from 10-20, unmuted from 20-30
      await db.run(`
        INSERT INTO automation_points (point_id, parameter_id, time_position, value, created_at) VALUES
        ('point-1', 'param-mute', 0, 0, '2024-01-01'),    -- unmuted at start
        ('point-2', 'param-mute', 10, 1, '2024-01-01'),   -- muted at 10
        ('point-3', 'param-mute', 20, 0, '2024-01-01')    -- unmuted at 20
      `);

      const clips = await db.getClipsForTrack('track-1');
      
      expect(clips).toHaveLength(2);
      
      // First clip: 0-10 (unmuted)
      expect(clips[0]).toMatchObject({
        trackId: 'track-1',
        trackNumber: 1,
        startTime: 0,
        endTime: 10,
        duration: 10,
        isActive: true
      });

      // Second clip: 20-beyond (unmuted)
      expect(clips[1]).toMatchObject({
        trackId: 'track-1',
        trackNumber: 1,
        startTime: 20,
        endTime: 1020, // extends beyond last point
        duration: 1000,
        isActive: true
      });
    });

    it('should handle track that starts muted', async () => {
      // Track starts muted, becomes unmuted at 5, muted again at 15
      await db.run(`
        INSERT INTO automation_points (point_id, parameter_id, time_position, value, created_at) VALUES
        ('point-1', 'param-mute', 0, 1, '2024-01-01'),    -- muted at start
        ('point-2', 'param-mute', 5, 0, '2024-01-01'),    -- unmuted at 5
        ('point-3', 'param-mute', 15, 1, '2024-01-01')    -- muted at 15
      `);

      const clips = await db.getClipsForTrack('track-1');
      
      expect(clips).toHaveLength(1);
      
      // Single clip: 5-15 (unmuted)
      expect(clips[0]).toMatchObject({
        trackId: 'track-1',
        trackNumber: 1,
        startTime: 5,
        endTime: 15,
        duration: 10,
        isActive: true
      });
    });

    it('should handle track that is always unmuted', async () => {
      // No mute automation points - track remains in default state
      const clips = await db.getClipsForTrack('track-1');
      
      expect(clips).toHaveLength(1);
      
      // Should have one infinite clip since track.is_muted = false
      expect(clips[0]).toMatchObject({
        trackId: 'track-1',
        trackNumber: 1,
        startTime: 0,
        endTime: Number.MAX_VALUE,
        duration: Number.MAX_VALUE,
        isActive: true
      });
    });

    it('should handle track with no mute parameter', async () => {
      // Create track without mute parameter
      await db.run(`
        INSERT INTO tracks (track_id, device_id, track_number, track_name, is_muted, created_at)
        VALUES ('track-2', 'device-1', 2, 'Track 2', true, '2024-01-01')
      `);

      const clips = await db.getClipsForTrack('track-2');
      
      expect(clips).toHaveLength(1);
      
      // Should respect default mute state
      expect(clips[0]).toMatchObject({
        trackId: 'track-2',
        trackNumber: 2,
        startTime: 0,
        endTime: Number.MAX_VALUE,
        duration: Number.MAX_VALUE,
        isActive: false // track.is_muted = true, so clip is inactive
      });
    });
  });

  describe('Complex Mute Patterns', () => {
    it('should handle rapid mute/unmute transitions', async () => {
      await db.run(`
        INSERT INTO automation_points (point_id, parameter_id, time_position, value, created_at) VALUES
        ('point-1', 'param-mute', 0, 0, '2024-01-01'),    -- unmuted
        ('point-2', 'param-mute', 2, 1, '2024-01-01'),    -- muted  
        ('point-3', 'param-mute', 4, 0, '2024-01-01'),    -- unmuted
        ('point-4', 'param-mute', 6, 1, '2024-01-01'),    -- muted
        ('point-5', 'param-mute', 8, 0, '2024-01-01')     -- unmuted
      `);

      const clips = await db.getClipsForTrack('track-1');
      
      expect(clips).toHaveLength(3);
      
      expect(clips[0]).toMatchObject({ startTime: 0, endTime: 2, duration: 2 });
      expect(clips[1]).toMatchObject({ startTime: 4, endTime: 6, duration: 2 });
      expect(clips[2]).toMatchObject({ startTime: 8, endTime: 1008, duration: 1000 });
    });

    it('should handle edge case with single point', async () => {
      await db.run(`
        INSERT INTO automation_points (point_id, parameter_id, time_position, value, created_at) VALUES
        ('point-1', 'param-mute', 5, 0, '2024-01-01')     -- single unmute point
      `);

      const clips = await db.getClipsForTrack('track-1');
      
      expect(clips).toHaveLength(1);
      expect(clips[0]).toMatchObject({
        startTime: 0, // starts unmuted from beginning
        endTime: 1005, // extends beyond single point
        duration: 1005
      });
    });
  });

  describe('Device-level Clip Operations', () => {
    beforeEach(async () => {
      // Add second track
      await db.run(`
        INSERT INTO tracks (track_id, device_id, track_number, track_name, is_muted, created_at)
        VALUES ('track-2', 'device-1', 2, 'Track 2', false, '2024-01-01')
      `);

      await db.run(`
        INSERT INTO parameters (parameter_id, track_id, parameter_name, parameter_path, created_at)
        VALUES ('param-mute-2', 'track-2', 'T2 Muted', '/path/to/mute2', '2024-01-01')
      `);

      // Simple automation for both tracks
      await db.run(`
        INSERT INTO automation_points (point_id, parameter_id, time_position, value, created_at) VALUES
        ('point-t1-1', 'param-mute', 0, 0, '2024-01-01'),      -- T1 unmuted 0-10
        ('point-t1-2', 'param-mute', 10, 1, '2024-01-01'),     -- T1 muted at 10
        ('point-t2-1', 'param-mute-2', 0, 1, '2024-01-01'),    -- T2 muted 0-5
        ('point-t2-2', 'param-mute-2', 5, 0, '2024-01-01')     -- T2 unmuted at 5
      `);
    });

    it('should get clips for all tracks in device', async () => {
      const clips = await db.getClipsForDevice('device-1');
      
      expect(clips).toHaveLength(2);
      
      // Should be sorted by track number, then start time
      expect(clips[0]).toMatchObject({
        trackNumber: 1,
        startTime: 0,
        endTime: 10
      });
      
      expect(clips[1]).toMatchObject({
        trackNumber: 2,
        startTime: 5,
        endTime: 1005
      });
    });
  });
});
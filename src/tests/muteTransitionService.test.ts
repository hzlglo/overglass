import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { MuteTransitionService } from '../lib/database/services/muteTransitionService';
import { ALSParser } from '../lib/parsers/alsParser';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import type { MuteTransition } from '../lib/database/schema';

describe('MuteTransitionService', () => {
  let database: AutomationDatabase;
  let service: MuteTransitionService;
  let parser: ALSParser;
  let testFile: File;
  let existingTransitions: MuteTransition[];
  let testTrackIds: string[];
  let testMuteParameterIds: string[];

  beforeEach(async () => {
    // Load test1.als file
    const buffer = readFileSync('./src/tests/test1.als');
    testFile = {
      name: 'test1.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Create in-memory database and load ALS data
    parser = new ALSParser();
    database = new AutomationDatabase(new NativeDuckDBAdapter());
    await database.initialize();

    // Parse ALS file first, then load the parsed data
    const parsedALS = await parser.parseALSFile(testFile);
    await database.loadALSData(parsedALS);

    // Initialize service and collect test data
    service = new MuteTransitionService(database);

    // Get existing transitions to work with
    const allTransitions = await database.run(`
      SELECT id, track_id, time_position, is_muted, mute_parameter_id, created_at, updated_at
      FROM mute_transitions
      ORDER BY track_id, time_position
    `);

    existingTransitions = allTransitions.map((row: any) => ({
      id: row.id,
      trackId: row.trackId,
      timePosition: row.timePosition,
      isMuted: row.isMuted,
      muteParameterId: row.muteParameterId,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    }));

    // Get unique track IDs and mute parameter IDs
    testTrackIds = [...new Set(existingTransitions.map(t => t.trackId))];
    testMuteParameterIds = [...new Set(existingTransitions.map(t => t.muteParameterId))];

    console.log(`Found ${existingTransitions.length} existing mute transitions across ${testTrackIds.length} tracks`);
    existingTransitions.forEach((t, i) => {
      console.log(`  Transition ${i + 1}: time=${t.timePosition}, muted=${t.isMuted}, trackId=${t.trackId ? t.trackId.slice(-8) : 'undefined'}`);
    });
  });

  afterEach(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('using test1.als data', () => {
    it('should have loaded existing mute transitions from test1.als', () => {
      expect(existingTransitions.length).toBeGreaterThan(0);
      expect(testTrackIds.length).toBeGreaterThan(0);
      expect(testMuteParameterIds.length).toBeGreaterThan(0);

      // Verify transitions are properly alternating within each track
      for (const trackId of testTrackIds) {
        const trackTransitions = existingTransitions
          .filter(t => t.trackId === trackId)
          .sort((a, b) => a.timePosition - b.timePosition);

        console.log(`Track ${trackId ? trackId.slice(-8) : 'undefined'} has ${trackTransitions.length} transitions:`);
        trackTransitions.forEach((t, i) => {
          console.log(`  ${i + 1}: time=${t.timePosition}, muted=${t.isMuted}`);
        });

        // Verify alternating pattern
        for (let i = 1; i < trackTransitions.length; i++) {
          expect(trackTransitions[i].isMuted).not.toBe(trackTransitions[i - 1].isMuted);
        }
      }
    });

    it('should add a new mute transition correctly', async () => {
      const trackId = testTrackIds[0];
      const muteParameterId = testMuteParameterIds[0];
      const trackTransitions = existingTransitions.filter(t => t.trackId === trackId);

      console.log(`Adding transition to track with ${trackTransitions.length} existing transitions`);

      // Find a good spot between existing transitions
      const sortedTransitions = trackTransitions.sort((a, b) => a.timePosition - b.timePosition);
      let newTransitionTime: number;

      if (sortedTransitions.length >= 2) {
        // Add between first and second transition
        const gap = sortedTransitions[1].timePosition - sortedTransitions[0].timePosition;
        newTransitionTime = sortedTransitions[0].timePosition + (gap / 2);
      } else {
        // Add after the last transition
        newTransitionTime = sortedTransitions[sortedTransitions.length - 1].timePosition + 10;
      }

      const createdTransitions = await service.addMuteTransition(trackId, newTransitionTime, muteParameterId);

      expect(createdTransitions.length).toBeGreaterThan(0);
      console.log(`Created ${createdTransitions.length} transitions at time ${newTransitionTime}`);

      // Verify the new transitions maintain alternating pattern
      const allTransitions = await service.getMuteTransitionsForTrack(trackId);
      const sortedAll = allTransitions.sort((a, b) => a.timePosition - b.timePosition);

      for (let i = 1; i < sortedAll.length; i++) {
        expect(sortedAll[i].isMuted).not.toBe(sortedAll[i - 1].isMuted);
      }
    });

    it('should move existing transitions maintaining alternating pattern', async () => {
      if (existingTransitions.length < 2) {
        console.log('Skipping test - need at least 2 transitions');
        return;
      }

      const trackId = testTrackIds[0];
      const trackTransitions = existingTransitions
        .filter(t => t.trackId === trackId)
        .sort((a, b) => a.timePosition - b.timePosition);

      if (trackTransitions.length < 2) {
        console.log('Skipping test - track needs at least 2 transitions');
        return;
      }

      const transitionToMove = trackTransitions[0];
      const originalTime = transitionToMove.timePosition;
      const deltaTime = 5.0; // Move 5 seconds later

      console.log(`Moving transition from ${originalTime} by ${deltaTime} seconds`);

      await service.moveMuteTransitions([transitionToMove.id], deltaTime);

      const movedTransition = await service.getMuteTransition(transitionToMove.id);
      expect(movedTransition?.timePosition).toBe(originalTime + deltaTime);

      // Verify alternating pattern is maintained
      const allTransitions = await service.getMuteTransitionsForTrack(trackId);
      const sortedAll = allTransitions.sort((a, b) => a.timePosition - b.timePosition);

      console.log('Final transitions after move:');
      sortedAll.forEach((t, i) => {
        console.log(`  ${i + 1}: time=${t.timePosition}, muted=${t.isMuted}`);
      });

      for (let i = 1; i < sortedAll.length; i++) {
        expect(sortedAll[i].isMuted).not.toBe(sortedAll[i - 1].isMuted);
      }
    });

    it('should delete a transition successfully', async () => {
      const transitionToDelete = existingTransitions[0];
      const trackId = transitionToDelete.trackId;
      const originalCount = existingTransitions.filter(t => t.trackId === trackId).length;

      console.log(`Deleting transition at time ${transitionToDelete.timePosition} from track with ${originalCount} transitions`);

      await service.deleteMuteTransition(transitionToDelete.id);

      const deletedTransition = await service.getMuteTransition(transitionToDelete.id);
      expect(deletedTransition).toBeNull();

      const remainingTransitions = await service.getMuteTransitionsForTrack(trackId);
      expect(remainingTransitions.length).toBe(originalCount - 1);
    });

    it('should get transitions for device correctly', async () => {
      // Get the device ID from the database
      const devices = await database.run('SELECT id FROM devices LIMIT 1');
      expect(devices.length).toBeGreaterThan(0);
      const deviceId = devices[0].id;

      const deviceTransitions = await service.getMuteTransitionsForDevice(deviceId);

      console.log(`Found ${deviceTransitions.length} transitions for device`);

      expect(deviceTransitions.length).toBeGreaterThan(0);
      expect(deviceTransitions.every(t => t.trackName)).toBe(true);

      // Should be ordered by track number, then time
      for (let i = 1; i < deviceTransitions.length; i++) {
        const prev = deviceTransitions[i - 1];
        const curr = deviceTransitions[i];

        // Either different track or same track with later time
        if (prev.trackId === curr.trackId) {
          expect(curr.timePosition).toBeGreaterThanOrEqual(prev.timePosition);
        }
      }
    });
  });
});
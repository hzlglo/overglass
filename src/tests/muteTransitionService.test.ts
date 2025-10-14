import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { MuteTransitionService } from '../lib/database/services/muteTransitionService';
import { ALSParser } from '../lib/parsers/alsParser';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import type { MuteTransition } from '../lib/database/schema';

describe('MuteTransitionService - Clip-Based Operations', () => {
  let database: AutomationDatabase;
  let service: MuteTransitionService;
  let parser: ALSParser;
  let testFile: File;

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

    // Initialize service
    service = new MuteTransitionService(database);
  });

  afterEach(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('deleteMuteTransitions', () => {
    it('should delete first positive transition and toggle initial state', async () => {
      // Get track with transitions
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const originalTransitions = await service.getMuteTransitionsForTrack(trackId);

      const sortedTransitions = originalTransitions.sort((a, b) => a.timePosition - b.timePosition);
      const negativeTransition = sortedTransitions.find((t) => t.timePosition < 0);
      const firstPositive = sortedTransitions.find((t) => t.timePosition >= 0);

      if (!negativeTransition || !firstPositive) {
        console.log('Skipping test - need negative and positive transitions');
        return;
      }

      const originalInitialState = negativeTransition.isMuted;
      console.log(
        `Original initial state: ${originalInitialState}, deleting first positive at time ${firstPositive.timePosition}`,
      );

      // Delete first positive transition
      await service.deleteMuteTransitions([firstPositive.id]);

      // Verify initial state was toggled
      const updatedNegativeTransition = await service.getMuteTransition(negativeTransition.id);
      expect(updatedNegativeTransition?.isMuted).toBe(!originalInitialState);

      // Verify first positive was deleted
      const deletedTransition = await service.getMuteTransition(firstPositive.id);
      expect(deletedTransition).toBeNull();

      console.log(
        `✅ Initial state toggled from ${originalInitialState} to ${!originalInitialState}`,
      );
    });

    it('should delete only the last transition when deleting only last', async () => {
      // Get track with transitions
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const originalTransitions = await service.getMuteTransitionsForTrack(trackId);

      const positiveTransitions = originalTransitions.filter((t) => t.timePosition >= 0);
      const lastTransition = positiveTransitions[positiveTransitions.length - 1];

      if (!lastTransition) {
        console.log('Skipping test - need positive transitions');
        return;
      }

      const originalCount = originalTransitions.length;
      console.log(`Deleting only last transition at time ${lastTransition.timePosition}`);

      // Delete only last transition
      await service.deleteMuteTransitions([lastTransition.id]);

      // Verify only one transition was deleted
      const remainingTransitions = await service.getMuteTransitionsForTrack(trackId);
      expect(remainingTransitions.length).toBe(originalCount - 1);

      // Verify the specific transition was deleted
      const deletedTransition = await service.getMuteTransition(lastTransition.id);
      expect(deletedTransition).toBeNull();

      console.log(
        `✅ Deleted only last transition, count: ${originalCount} → ${remainingTransitions.length}`,
      );
    });

    it('should delete entire clips in general case', async () => {
      // Create a test scenario with known clip structure
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing transitions and create a known pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:ON, 10:OFF, 20:ON, 30:OFF, 40:ON
      // This creates clips: [10-20] and [30-40]
      const initialTransition = await service.createMuteTransition(
        trackId,
        -60000,
        true,
        muteParameterId,
      );
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      const clip2Start = await service.createMuteTransition(trackId, 30, false, muteParameterId);
      const clip2End = await service.createMuteTransition(trackId, 40, true, muteParameterId);

      console.log('Created test pattern: clips [10-20] and [30-40]');

      // Delete a transition from the first clip (but not the first positive) - should delete entire clip
      await service.deleteMuteTransitions([clip1End.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have deleted both clip1Start and clip1End, leaving: -60000, 30, 40
      expect(remainingTimes).toEqual([-60000, 30, 40]);

      console.log(`✅ Deleted entire clip: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should handle deleting first positive with other transitions using clip logic', async () => {
      // This test exposes the bug where Case 1 doesn't use clip-based logic for other transitions
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create known pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:MUTED, 10:UNMUTED, 20:MUTED, 30:UNMUTED, 40:MUTED
      // This creates clips: [10-20] and [30-40]
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      const clip2Start = await service.createMuteTransition(trackId, 30, false, muteParameterId);
      const clip2End = await service.createMuteTransition(trackId, 40, true, muteParameterId);

      console.log('Created pattern: MUTED initial, clips [10-20], [30-40]');
      console.log('Deleting first positive (10) + clip2Start (30) - should maintain alternating pattern');

      // Delete first positive (10) and clip2Start (30)
      // This should:
      // 1. Toggle initial state to UNMUTED
      // 2. Delete the entire first clip (10, 20)
      // 3. Delete clip2Start's entire clip (30, 40) using clip logic
      await service.deleteMuteTransitions([clip1Start.id, clip2Start.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);
      const remainingTimes = sortedRemaining.map((t) => t.timePosition);

      console.log(`Remaining times: [${remainingTimes.join(', ')}]`);
      console.log('Remaining states:', sortedRemaining.map((t) => `${t.timePosition}:${t.isMuted ? 'MUTED' : 'UNMUTED'}`).join(', '));

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(
          sortedRemaining[i - 1].isMuted,
          `Pattern broken at index ${i}: ${sortedRemaining[i - 1].timePosition}:${sortedRemaining[i - 1].isMuted} → ${sortedRemaining[i].timePosition}:${sortedRemaining[i].isMuted}`,
        );
      }

      console.log('✅ Maintained alternating pattern after complex deletion');
    });

    it('should handle deleting first and last transitions together', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:MUTED, 10:UNMUTED, 20:MUTED, 30:UNMUTED
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);
      const first = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      await service.createMuteTransition(trackId, 20, true, muteParameterId);
      const last = await service.createMuteTransition(trackId, 30, false, muteParameterId);

      console.log('Created pattern with first and last, deleting both');

      // Delete first and last together
      await service.deleteMuteTransitions([first.id, last.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(sortedRemaining[i - 1].isMuted);
      }

      console.log('✅ Handled deleting first and last together');
    });

    it('should handle deleting all positive transitions', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:MUTED, 10:UNMUTED, 20:MUTED
      const initial = await service.createMuteTransition(trackId, -60000, true, muteParameterId);
      const t1 = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const t2 = await service.createMuteTransition(trackId, 20, true, muteParameterId);

      console.log('Created pattern, deleting all positive transitions');

      // Delete all positive transitions
      await service.deleteMuteTransitions([t1.id, t2.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);

      // Should only have the initial transition left, without toggling state
      // (complete clip deletion doesn't toggle initial state)
      expect(remaining.length).toBe(1);
      expect(remaining[0].timePosition).toBe(-60000);
      expect(remaining[0].isMuted).toBe(true); // Should stay MUTED (not toggled)

      console.log('✅ Handled deleting all positive transitions');
    });

    it('should handle deleting entire first clip (both start and end)', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:MUTED, 10:UNMUTED, 20:MUTED, 30:UNMUTED, 40:MUTED
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      await service.createMuteTransition(trackId, 30, false, muteParameterId);
      await service.createMuteTransition(trackId, 40, true, muteParameterId);

      console.log('Created pattern, deleting entire first clip [10-20]');

      // Delete both transitions of the first clip
      await service.deleteMuteTransitions([clip1Start.id, clip1End.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);
      const remainingTimes = sortedRemaining.map((t) => t.timePosition);

      // Should have deleted the entire clip [10-20] without toggling initial state
      // Remaining: -60000:MUTED, 30:UNMUTED, 40:MUTED
      expect(remainingTimes).toEqual([-60000, 30, 40]);

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(sortedRemaining[i - 1].isMuted);
      }

      console.log('✅ Handled deleting entire first clip');
    });

    it('should handle deleting first clip when second infinite clip exists', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:MUTED, 10:UNMUTED, 20:MUTED, 30:UNMUTED (infinite)
      // This creates clips: [10-20] and [30-∞]
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      await service.createMuteTransition(trackId, 30, false, muteParameterId);

      console.log('Created pattern: MUTED initial, clip [10-20], infinite clip [30-∞]');
      console.log('Deleting entire first clip [10, 20]');

      // Delete both transitions of the first clip
      await service.deleteMuteTransitions([clip1Start.id, clip1End.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);
      const remainingTimes = sortedRemaining.map((t) => t.timePosition);

      console.log('Remaining transitions:', sortedRemaining.map((t) => `${t.timePosition}:${t.isMuted ? 'MUTED' : 'UNMUTED'}`).join(', '));

      // Should keep initial MUTED state and the infinite clip start
      // Expected: -60000:MUTED, 30:UNMUTED
      expect(remainingTimes).toEqual([-60000, 30]);
      expect(sortedRemaining[0].isMuted).toBe(true); // Initial should stay MUTED
      expect(sortedRemaining[1].isMuted).toBe(false); // Second clip should stay UNMUTED

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(sortedRemaining[i - 1].isMuted);
      }

      console.log('✅ Handled deleting first clip with infinite second clip');
    });
  });

  describe('mergeMuteTransitionClips', () => {
    it('should merge multiple clips into one', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create test pattern
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:OFF, 10:ON, 20:OFF, 30:ON, 40:OFF, 50:ON, 60:OFF
      // This creates clips: [10-20], [30-40], [50-60]
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      const clip2Start = await service.createMuteTransition(trackId, 30, false, muteParameterId);
      const clip2End = await service.createMuteTransition(trackId, 40, true, muteParameterId);
      const clip3Start = await service.createMuteTransition(trackId, 50, false, muteParameterId);
      const clip3End = await service.createMuteTransition(trackId, 60, true, muteParameterId);

      console.log('Created test pattern: clips [10-20], [30-40], [50-60]');

      // Merge clips 1 and 3 (should also include clip 2 between them)
      await service.mergeMuteTransitionClips([clip1Start.id, clip3End.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have merged all clips into one: -60000, 10, 60
      expect(remainingTimes).toEqual([-60000, 10, 60]);

      console.log(`✅ Merged clips: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should handle infinite clips when merging', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern with infinite clip
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create pattern: -60000:OFF, 10:ON, 20:OFF, 30:ON (infinite)
      // This creates clips: [10-20], [30-∞]
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      const clip1Start = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const clip1End = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      const infiniteClipStart = await service.createMuteTransition(
        trackId,
        30,
        false,
        muteParameterId,
      );

      console.log('Created pattern with infinite clip: clips [10-20], [30-∞]');

      // Merge finite and infinite clips
      await service.mergeMuteTransitionClips([clip1Start.id, infiniteClipStart.id]);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have merged into infinite clip: -60000, 10
      expect(remainingTimes).toEqual([-60000, 10]);

      console.log(`✅ Merged with infinite clip: remaining times [${remainingTimes.join(', ')}]`);
    });
  });

  describe('getMovedMuteTransitions', () => {
    it('should prevent moving before time 0', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const transitions = await service.getMuteTransitionsForTrack(trackId);

      const positiveTransition = transitions.find((t) => t.timePosition > 0 && t.timePosition < 10);
      if (!positiveTransition) {
        console.log('Skipping test - need transition between 0 and 10');
        return;
      }

      // Try to move transition to negative time
      const deltaTime = -positiveTransition.timePosition - 5; // Should be negative
      const moved = MuteTransitionService.getMovedMuteTransitions(
        [positiveTransition],
        transitions,
        deltaTime,
      );

      expect(moved.length).toBe(1);
      expect(moved[0].timePosition).toBe(0); // Should be clamped to 0

      console.log(
        `✅ Prevented negative movement: ${positiveTransition.timePosition} + ${deltaTime} → ${moved[0].timePosition}`,
      );
    });

    it('should prevent collision with neighbors', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const transitions = await service.getMuteTransitionsForTrack(trackId);

      const sortedTransitions = transitions
        .filter((t) => t.timePosition >= 0)
        .sort((a, b) => a.timePosition - b.timePosition);

      if (sortedTransitions.length < 2) {
        console.log('Skipping test - need at least 2 positive transitions');
        return;
      }

      const firstTransition = sortedTransitions[0];
      const secondTransition = sortedTransitions[1];
      const gap = secondTransition.timePosition - firstTransition.timePosition;

      // Try to move first transition past the second
      const deltaTime = gap + 5; // Should cause collision
      const moved = MuteTransitionService.getMovedMuteTransitions(
        [firstTransition],
        transitions,
        deltaTime,
      );

      expect(moved.length).toBe(1);
      expect(moved[0].timePosition).toBeLessThan(secondTransition.timePosition);
      expect(moved[0].timePosition).toBeCloseTo(secondTransition.timePosition - 0.001, 3);

      console.log(
        `✅ Prevented collision: tried to move ${gap + 5} but limited to ${moved[0].timePosition - firstTransition.timePosition}`,
      );
    });

    it('should move multiple transitions by same constrained amount', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Create test scenario with controlled spacing
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create: -60000:OFF, 10:ON, 20:OFF, 50:ON (big gap after 20)
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      const t1 = await service.createMuteTransition(trackId, 10, false, muteParameterId);
      const t2 = await service.createMuteTransition(trackId, 20, true, muteParameterId);
      await service.createMuteTransition(trackId, 50, false, muteParameterId);

      // Get all transitions for the track after setup
      const allTransitions = await service.getMuteTransitionsForTrack(trackId);

      // Try to move both t1 and t2 by 40 seconds (t2 would hit 50, so should be limited)
      const moved = MuteTransitionService.getMovedMuteTransitions([t1, t2], allTransitions, 40);

      expect(moved.length).toBe(2);

      // Both should move by same (limited) amount
      const deltaApplied1 = moved[0].timePosition - 10;
      const deltaApplied2 = moved[1].timePosition - 20;
      expect(deltaApplied1).toBeCloseTo(deltaApplied2, 3);

      // Should be limited by collision with transition at 50
      expect(moved[1].timePosition).toBeLessThan(50);

      console.log(
        `✅ Moved multiple transitions by same constrained amount: ${deltaApplied1.toFixed(3)} seconds`,
      );
    });
  });

  describe('addMuteTransitionClip', () => {
    it('should split existing clip when adding inside it', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create a single clip
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create clip: -60000:OFF, 10:ON, 50:OFF (clip from 10-50)
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      await service.createMuteTransition(trackId, 10, false, muteParameterId);
      await service.createMuteTransition(trackId, 50, true, muteParameterId);

      console.log('Created clip [10-50], adding muted section at time 30');

      // Add muted section inside the clip at time 30
      const created = await service.addMuteTransitionClip(trackId, 30);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have split the clip: -60000, 10, 30, 32, 50
      // Original clip [10-50] becomes [10-30] + [32-50] with muted section [30-32]
      expect(remainingTimes.length).toBe(5);
      expect(remainingTimes).toContain(-60000);
      expect(remainingTimes).toContain(10);
      expect(remainingTimes).toContain(30);
      expect(remainingTimes).toContain(50);

      console.log(`✅ Split clip: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should create new clip in muted space', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create muted space
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create: -60000:MUTED (everything muted)
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);

      console.log('Created muted space, adding clip at time 30');

      // Add clip in muted space
      // Expected: Toggle initial to UNMUTED, then since we're in unmuted space,
      // add MUTED transition to end it (not create a clip)
      const created = await service.addMuteTransitionClip(trackId, 30);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have toggled initial and added MUTED: -60000:UNMUTED, 30:MUTED
      expect(remainingTimes.length).toBe(2);
      expect(remainingTimes).toEqual([-60000, 30]);

      console.log(`✅ Created new clip: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should toggle initial state when adding at beginning', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create initial muted state
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create: -60000:ON, 50:OFF
      const initialTransition = await service.createMuteTransition(
        trackId,
        -60000,
        true,
        muteParameterId,
      );
      await service.createMuteTransition(trackId, 50, false, muteParameterId);

      console.log('Created initial muted state, adding clip at time 5 (before first positive)');

      // Add clip at beginning (before any positive transitions)
      await service.addMuteTransitionClip(trackId, 5);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const initialState = remaining.find((t) => t.timePosition < 0);

      // Initial state should be toggled from true to false
      expect(initialState?.isMuted).toBe(false);

      // Should have transitions: -60000:OFF, 5:ON, 50:OFF
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);
      expect(remainingTimes).toEqual([-60000, 5, 50]);

      console.log(`✅ Toggled initial state to ${initialState?.isMuted} and added transition at 5`);
    });

    it('should add single transition at end for infinite clip', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern ending in infinite clip
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create: -60000:OFF, 30:ON (infinite clip from 30)
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      await service.createMuteTransition(trackId, 30, false, muteParameterId);

      console.log('Created infinite clip [30-∞], adding muted section at time 50');

      // Add at end of song (inside infinite clip)
      await service.addMuteTransitionClip(trackId, 50);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should add single transition to end the infinite clip: -60000, 30, 50
      expect(remainingTimes).toEqual([-60000, 30, 50]);

      console.log(`✅ Added end to infinite clip: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should add single transition at end of song in muted space', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing and create pattern that ends in muted space
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create: -60000:OFF, 30:ON, 40:OFF (track ends muted after 40)
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);
      await service.createMuteTransition(trackId, 30, false, muteParameterId);
      await service.createMuteTransition(trackId, 40, true, muteParameterId);

      console.log('Created pattern ending in muted space, adding clip at time 50 (end of song)');

      // Add at end of song (after last transition, in muted space)
      const created = await service.addMuteTransitionClip(trackId, 50);

      // Should only create 1 transition (to unmute for rest of song)
      expect(created.length).toBe(1);
      expect(created[0].timePosition).toBe(50);
      expect(created[0].isMuted).toBe(false); // Should unmute for rest of song

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const remainingTimes = remaining.map((t) => t.timePosition).sort((a, b) => a - b);

      // Should have added single transition: -60000, 30, 40, 50
      expect(remainingTimes).toEqual([-60000, 30, 40, 50]);

      console.log(`✅ Added single transition at end of song: remaining times [${remainingTimes.join(', ')}]`);
    });

    it('should handle adding clip when only initial MUTED transition exists', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing transitions
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create only initial MUTED transition
      await service.createMuteTransition(trackId, -60000, true, muteParameterId);

      console.log('Created initial MUTED state only, adding clip at time 30');

      // Add clip at time 30
      // Expected: Toggle initial to UNMUTED, then since we're in unmuted space,
      // we should add MUTED transition to end the unmuted space, NOT create a clip
      await service.addMuteTransitionClip(trackId, 30);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);

      console.log('Remaining transitions:', sortedRemaining.map((t) => `${t.timePosition}:${t.isMuted ? 'MUTED' : 'UNMUTED'}`).join(', '));

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(sortedRemaining[i - 1].isMuted);
      }

      console.log('✅ Handled adding clip with only initial MUTED transition');
    });

    it('should handle adding clip when only initial UNMUTED transition exists', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const params = await database.run('SELECT id FROM parameters WHERE is_mute = true LIMIT 1');
      const muteParameterId = params[0].id;

      // Clear existing transitions
      const existing = await service.getMuteTransitionsForTrack(trackId);
      for (const t of existing) {
        await service.deleteMuteTransition(t.id);
      }

      // Create only initial UNMUTED transition
      await service.createMuteTransition(trackId, -60000, false, muteParameterId);

      console.log('Created initial UNMUTED state only, adding clip at time 30');

      // Add clip at time 30
      // Expected: Toggle initial to MUTED, then create an unmuted clip [30:UNMUTED, 32:MUTED]
      await service.addMuteTransitionClip(trackId, 30);

      const remaining = await service.getMuteTransitionsForTrack(trackId);
      const sortedRemaining = remaining.sort((a, b) => a.timePosition - b.timePosition);

      console.log('Remaining transitions:', sortedRemaining.map((t) => `${t.timePosition}:${t.isMuted ? 'MUTED' : 'UNMUTED'}`).join(', '));

      // Verify alternating pattern is maintained
      for (let i = 1; i < sortedRemaining.length; i++) {
        expect(sortedRemaining[i].isMuted).not.toBe(sortedRemaining[i - 1].isMuted);
      }

      console.log('✅ Handled adding clip with only initial UNMUTED transition');
    });
  });

  describe('updateMuteTransitions', () => {
    it('should update transition times directly', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;
      const transitions = await service.getMuteTransitionsForTrack(trackId);

      const positiveTransitions = transitions.filter((t) => t.timePosition > 0);
      if (positiveTransitions.length === 0) {
        console.log('Skipping test - need positive transitions');
        return;
      }

      const transitionToUpdate = positiveTransitions[0];
      const originalTime = transitionToUpdate.timePosition;
      const newTime = originalTime + 100; // Move to a safe spot

      console.log(`Updating transition from ${originalTime} to ${newTime}`);

      await service.updateMuteTransitions([
        {
          id: transitionToUpdate.id,
          timePosition: newTime,
        },
      ]);

      const updated = await service.getMuteTransition(transitionToUpdate.id);
      expect(updated?.timePosition).toBe(newTime);

      console.log(`✅ Updated transition time: ${originalTime} → ${updated?.timePosition}`);
    });
  });

  describe('integration with existing functionality', () => {
    it('should maintain alternating patterns after all operations', async () => {
      const tracks = await database.run('SELECT id FROM tracks LIMIT 1');
      const trackId = tracks[0].id;

      // Test that any track maintains alternating pattern
      const transitions = await service.getMuteTransitionsForTrack(trackId);
      const sortedTransitions = transitions.sort((a, b) => a.timePosition - b.timePosition);

      console.log('Verifying alternating pattern is maintained:');
      sortedTransitions.forEach((t, i) => {
        console.log(`  ${i + 1}: time=${t.timePosition.toFixed(3)}, muted=${t.isMuted}`);
      });

      // Verify alternating pattern
      for (let i = 1; i < sortedTransitions.length; i++) {
        expect(sortedTransitions[i].isMuted).not.toBe(sortedTransitions[i - 1].isMuted);
      }

      console.log(
        `✅ Alternating pattern maintained across ${sortedTransitions.length} transitions`,
      );
    });
  });
});

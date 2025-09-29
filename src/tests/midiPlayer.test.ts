import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { MidiPlayer } from '$lib/database/services/midiPlayer';

describe('Midi Player', () => {
  let db: AutomationDatabase;
  let testTrackId: string;
  let testParameterId: string;
  let midiPlayer: MidiPlayer;
  let muteParameterId: string = 'test-param-2';
  beforeAll(async () => {
    // Initialize database with test data
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();
    await db.insertRecord('devices', {
      id: 'test-device-1',
      deviceName: 'Test Device',
      deviceType: 'Elektron',
      createdAt: new Date(),
    });
    testTrackId = 'test-track-1';
    await db.insertRecord('tracks', {
      id: testTrackId,
      deviceId: 'test-device-1',
      trackName: 'Test Device Track 1',
      trackNumber: 1,
      createdAt: new Date(),
    });
    testParameterId = 'test-param-1';
    await db.insertRecord('parameters', {
      id: testParameterId,
      trackId: 'test-track-1',
      parameterName: 'Volume',
      parameterPath: '/Test Device/Volume',
      originalPointeeId: 12345,
      createdAt: new Date(),
    });
    await db.insertRecord('parameters', {
      id: muteParameterId,
      trackId: testTrackId,
      parameterName: 'Mute',
      parameterPath: '/Test Device/Mute',
      originalPointeeId: 12345,
      createdAt: new Date(),
      isMute: true,
    });
    midiPlayer = new MidiPlayer(db, {
      deviceMappings: { 'Test Device': { Volume: { cc_msb: 1 } } },
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('getInterpolatedValuesToPlay', () => {
    afterEach(async () => {
      await db.run('DELETE FROM automation_points');
    });
    describe('flat', () => {
      it('at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2000, 0);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: true,
          granularity: 0.5,
        });
        expect(result).toEqual([{ timePosition: 0, value: 0 }]);
      });
      it('not at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2000, 0);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: false,
          granularity: 0.5,
        });
        expect(result).toEqual([]);
      });
    });
    describe('change outside of range', () => {
      it('at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2, 0);
        await db.automation.createAutomationPoint(testParameterId, 2, 1);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: true,
          granularity: 0.5,
        });
        expect(result).toEqual([
          { timePosition: 0, value: 0.5 },
          { timePosition: 0.5, value: 0.625 },
          { timePosition: 1, value: 0.75 },
        ]);
      });
      it('not at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2, 0);
        await db.automation.createAutomationPoint(testParameterId, 2, 1);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: false,
          granularity: 0.5,
        });
        expect(result).toEqual([
          { timePosition: 0, value: 0.5 },
          { timePosition: 0.5, value: 0.625 },
          { timePosition: 1, value: 0.75 },
        ]);
      });
    });
    describe('change inside of range', () => {
      it('at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2, 0);
        await db.automation.createAutomationPoint(testParameterId, 0.5, 0);
        await db.automation.createAutomationPoint(testParameterId, 1.5, 1);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: true,
          granularity: 0.1,
        });
        expect(result).toEqual([
          { timePosition: 0, value: 0 },
          { timePosition: 0.6, value: 0.1 },
          { timePosition: 0.7, value: 0.2 },
          { timePosition: 0.8, value: 0.3 },
          { timePosition: 0.9, value: 0.4 },
          { timePosition: 1, value: 0.5 },
        ]);
      });
      it('not at the beginning', async () => {
        await db.automation.createAutomationPoint(testParameterId, -2, 0);
        await db.automation.createAutomationPoint(testParameterId, 0.5, 0);
        await db.automation.createAutomationPoint(testParameterId, 1.5, 1);
        const result = await midiPlayer.getInterpolatedValuesToPlay({
          parameterId: testParameterId,
          startTime: 0,
          endTime: 1,
          isBeginningPlay: false,
          granularity: 0.1,
        });
        expect(result).toEqual([
          // { timePosition: 0, value: 0 },
          { timePosition: 0.6, value: 0.1 },
          { timePosition: 0.7, value: 0.2 },
          { timePosition: 0.8, value: 0.3 },
          { timePosition: 0.9, value: 0.4 },
          { timePosition: 1, value: 0.5 },
        ]);
      });
    });
  });
  describe('getMuteTransitionsToPlay', () => {
    afterEach(async () => {
      await db.run('DELETE FROM mute_transitions');
    });
    it('at the beginning', async () => {
      await db.muteTransitions.createMuteTransition(testTrackId, -2000, true, muteParameterId);
      await db.muteTransitions.createMuteTransition(testTrackId, 0.5, false, muteParameterId);
      await db.muteTransitions.createMuteTransition(testTrackId, 2, true, muteParameterId);
      const result = await midiPlayer.getMuteTransitionsToPlay(testTrackId, 0, 1, true);
      expect(result).toEqual([
        { timePosition: 0, isMuted: true },
        { timePosition: 0.5, isMuted: false },
      ]);
    });
    it('not at the beginning', async () => {
      await db.muteTransitions.createMuteTransition(testTrackId, -2000, true, muteParameterId);
      await db.muteTransitions.createMuteTransition(testTrackId, 0.5, false, muteParameterId);
      await db.muteTransitions.createMuteTransition(testTrackId, 2, true, muteParameterId);
      const result = await midiPlayer.getMuteTransitionsToPlay(testTrackId, 0, 1, false);
      expect(result).toEqual([{ timePosition: 0.5, isMuted: false }]);
    });
  });
});

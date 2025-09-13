import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { ALSParser } from '../lib/parsers/alsParser';

describe('Clip Movement API', () => {
  let db: AutomationDatabase;
  let parser: ALSParser;
  let testTrackId: string;
  let testParameterId: string;

  beforeAll(async () => {
    // Initialize database with test data
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();
    
    parser = new ALSParser();
    
    // Load test ALS data - create File-like object for Node.js
    const buffer = readFileSync('./src/tests/test1.als');
    const testFile = {
      name: 'test.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;
    
    const parsedData = await parser.parseALSFile(testFile);
    await db.loadALSData(parsedData);
    
    // Get test IDs
    const devices = await db.devices.getDevicesWithTracks();
    const tracks = await db.tracks.getTracksForDevice(devices[0].id);
    testTrackId = tracks[0].id;

    const parameters = await db.tracks.getParametersForTrack(testTrackId);
    testParameterId = parameters[0].id;
    
    // Create some test automation points for clip movement
    await db.automation.setAutomationPoint(testParameterId, 10.0, 0.2);
    await db.automation.setAutomationPoint(testParameterId, 15.0, 0.8);
    await db.automation.setAutomationPoint(testParameterId, 20.0, 0.5);
    
    console.log(`Using test track: ${testTrackId}`);
    console.log(`Test parameter: ${parameters[0].parameterName}`);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('moveClip', () => {
    it('should move automation points within clip time range with automation lock', async () => {
      const clipStartTime = 8.0;
      const clipEndTime = 22.0;
      const newStartTime = 32.0;
      const expectedOffset = newStartTime - clipStartTime; // 24.0
      
      // Get automation points before move
      const originalPoints = await db.automation.getAutomationPointsInRange(testParameterId, clipStartTime, clipEndTime);
      expect(originalPoints.length).toBeGreaterThan(0);
      
      // Move clip with automation lock enabled
      const result = await db.clips.moveClip(testTrackId, clipStartTime, clipEndTime, newStartTime, true);
      
      expect(result.success).toBe(true);
      expect(result.movedParameters.length).toBeGreaterThan(0);
      expect(result.message).toContain('beats');
      
      // Verify original points are gone
      const remainingPoints = await db.automation.getAutomationPointsInRange(testParameterId, clipStartTime, clipEndTime);
      expect(remainingPoints.length).toBe(0);
      
      // Verify points moved to new location
      const movedPoints = await db.automation.getAutomationPointsInRange(
        testParameterId,
        newStartTime,
        newStartTime + (clipEndTime - clipStartTime)
      );
      
      expect(movedPoints.length).toBe(originalPoints.length);
      
      // Verify time positions are correctly offset
      const expectedNewTimes = originalPoints.map(p => p.timePosition + expectedOffset);
      const actualNewTimes = movedPoints.map(p => p.timePosition);
      
      expectedNewTimes.forEach(expectedTime => {
        expect(actualNewTimes).toContain(expectedTime);
      });
      
      // Verify values are preserved
      const originalValues = originalPoints.map(p => p.value).sort();
      const movedValues = movedPoints.map(p => p.value).sort();
      expect(movedValues).toEqual(originalValues);
    });

    it('should only move mute parameters when automation lock is disabled', async () => {
      // Add automation to a non-mute parameter for testing
      const allParameters = await db.tracks.getParametersForTrack(testTrackId);
      const nonMuteParam = allParameters.find(p => !p.parameterName.toLowerCase().includes('mute'));
      
      if (nonMuteParam) {
        await db.automation.setAutomationPoint(nonMuteParam.id, 50.0, 0.7);
        await db.automation.setAutomationPoint(nonMuteParam.id, 55.0, 0.3);
        
        const clipStartTime = 48.0;
        const clipEndTime = 57.0;
        const newStartTime = 68.0;
        
        // Move clip with automation lock disabled
        const result = await db.clips.moveClip(testTrackId, clipStartTime, clipEndTime, newStartTime, false);
        
        expect(result.success).toBe(true);
        
        // Check that non-mute automation stayed in place
        const remainingNonMutePoints = await db.automation.getAutomationPointsInRange(
          nonMuteParam.id,
          clipStartTime,
          clipEndTime
        );
        expect(remainingNonMutePoints.length).toBeGreaterThan(0);
        
        // Only mute parameters should be in moved parameters list
        result.movedParameters.forEach(paramName => {
          expect(paramName.toLowerCase()).toContain('mute');
        });
      }
    });
  });

  describe('copyClip', () => {
    it('should duplicate automation points within clip time range', async () => {
      // Create test automation points
      const sourceStart = 80.0;
      const sourceEnd = 90.0;
      const copyStart = 100.0;
      
      await db.automation.setAutomationPoint(testParameterId, 82.0, 0.1);
      await db.automation.setAutomationPoint(testParameterId, 85.0, 0.6);
      await db.automation.setAutomationPoint(testParameterId, 88.0, 0.9);
      
      // Get original points count
      const originalPoints = await db.automation.getAutomationPointsInRange(testParameterId, sourceStart, sourceEnd);
      expect(originalPoints.length).toBe(3);
      
      // Copy clip
      const result = await db.clips.copyClip(testTrackId, sourceStart, sourceEnd, copyStart, true);
      
      expect(result.success).toBe(true);
      expect(result.copiedParameters.length).toBeGreaterThan(0);
      
      // Verify original points still exist
      const stillOriginalPoints = await db.automation.getAutomationPointsInRange(testParameterId, sourceStart, sourceEnd);
      expect(stillOriginalPoints.length).toBe(3);
      
      // Verify copied points exist at new location
      const copiedPoints = await db.automation.getAutomationPointsInRange(
        testParameterId,
        copyStart,
        copyStart + (sourceEnd - sourceStart)
      );
      
      expect(copiedPoints.length).toBe(originalPoints.length);
      
      // Verify values are duplicated
      const originalValues = originalPoints.map(p => p.value).sort();
      const copiedValues = copiedPoints.map(p => p.value).sort();
      expect(copiedValues).toEqual(originalValues);
      
      // Verify time positions are correctly offset
      const timeOffset = copyStart - sourceStart;
      const expectedCopiedTimes = originalPoints.map(p => p.timePosition + timeOffset);
      const actualCopiedTimes = copiedPoints.map(p => p.timePosition);
      
      expectedCopiedTimes.forEach(expectedTime => {
        expect(actualCopiedTimes).toContain(expectedTime);
      });
    });

    it('should work without copying automation when copyAutomation is false', async () => {
      const sourceStart = 120.0;
      const sourceEnd = 130.0;
      const copyStart = 140.0;
      
      // Create test points
      await db.automation.setAutomationPoint(testParameterId, 125.0, 0.4);
      
      // Copy clip without automation
      const result = await db.clips.copyClip(testTrackId, sourceStart, sourceEnd, copyStart, false);
      
      expect(result.success).toBe(true);
      expect(result.copiedParameters.length).toBe(0);
      
      // Verify no points were copied
      const copiedPoints = await db.automation.getAutomationPointsInRange(
        testParameterId,
        copyStart,
        copyStart + (sourceEnd - sourceStart)
      );
      
      expect(copiedPoints.length).toBe(0);
    });
  });

  describe('integration with clips', () => {
    it('should work with clip detection from mute automation', async () => {
      // Get actual clips from the track
      const clips = await db.clips.getClipsForTrack(testTrackId);
      
      if (clips.length > 0) {
        const firstClip = clips[0];
        const moveDistance = 50.0;
        
        console.log(`Moving clip: ${firstClip.startTime}-${firstClip.endTime} duration: ${firstClip.duration}`);
        
        // Move the clip
        const result = await db.clips.moveClip(
          testTrackId,
          firstClip.startTime,
          firstClip.endTime,
          firstClip.startTime + moveDistance,
          true
        );
        
        expect(result.success).toBe(true);
        expect(result.movedParameters).toBeDefined();
        
        console.log(`Moved clip result: ${result.message}`);
      } else {
        console.warn('No clips found for integration test');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid track IDs gracefully', async () => {
      const result = await db.clips.moveClip('invalid-track-id', 10, 20, 30, true);
      
      // Should still succeed but with no moved parameters
      expect(result.success).toBe(true);
      expect(result.movedParameters.length).toBe(0);
    });

    it('should handle clips with no automation points', async () => {
      // Use a time range with no automation
      const result = await db.clips.moveClip(testTrackId, 1000, 1010, 1020, true);
      
      expect(result.success).toBe(true);
      expect(result.movedParameters.length).toBe(0);
      expect(result.message).toContain('0 parameters');
    });
  });
});
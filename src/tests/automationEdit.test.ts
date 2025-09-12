import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { ALSParser } from '../lib/parsers/alsParser';

describe('Automation Edit API', () => {
  let db: AutomationDatabase;
  let parser: ALSParser;
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
    
    // Get a test parameter ID
    const devices = await db.devices.getDevicesWithTracks();
    const tracks = await db.devices.getTracksForDevice(devices[0].id);
    const parameters = await db.devices.getParametersForTrack(tracks[0].id);
    testParameterId = parameters[0].id;
    
    console.log(`Using test parameter: ${testParameterId} (${parameters[0].parameterName})`);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('setAutomationPoint', () => {
    it('should create a new automation point', async () => {
      const timePosition = 16.0; // 16 beats
      const value = 0.75;
      
      const result = await db.automation.setAutomationPoint(testParameterId, timePosition, value);
      
      expect(result).toMatchObject({
        parameterId: testParameterId,
        timePosition,
        value,
        id: expect.any(String)
      });
      
      expect(result.id).toBeTruthy();
    });

    it('should update an existing automation point at the same time', async () => {
      const timePosition = 16.0; // Same time as previous test
      const newValue = 0.25;
      
      const result = await db.automation.setAutomationPoint(testParameterId, timePosition, newValue);
      
      expect(result).toMatchObject({
        parameterId: testParameterId,
        timePosition,
        value: newValue
      });
      
      // Verify the point was updated, not duplicated
      const pointsInRange = await db.automation.getAutomationPointsInRange(testParameterId, 15.9, 16.1);
      expect(pointsInRange).toHaveLength(1);
      expect(pointsInRange[0].value).toBe(newValue);
    });

    it('should validate automation values', async () => {
      await expect(
        db.automation.setAutomationPoint(testParameterId, 20.0, 1.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');
      
      await expect(
        db.automation.setAutomationPoint(testParameterId, 20.0, -0.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');
    });

    it('should reject invalid parameter IDs', async () => {
      await expect(
        db.automation.setAutomationPoint('invalid-parameter-id', 24.0, 0.5)
      ).rejects.toThrow('Parameter invalid-parameter-id not found');
    });
  });

  describe('removeAutomationPoint', () => {
    it('should remove an existing automation point', async () => {
      const timePosition = 32.0;
      
      // First create a point
      await db.automation.setAutomationPoint(testParameterId, timePosition, 0.8);
      
      // Then remove it
      const wasRemoved = await db.automation.removeAutomationPoint(testParameterId, timePosition);
      expect(wasRemoved).toBe(true);
      
      // Verify it's gone
      const pointsInRange = await db.automation.getAutomationPointsInRange(testParameterId, 31.9, 32.1);
      expect(pointsInRange).toHaveLength(0);
    });

    it('should return false when removing non-existent point', async () => {
      const wasRemoved = await db.automation.removeAutomationPoint(testParameterId, 999.0);
      expect(wasRemoved).toBe(false);
    });
  });

  describe('getAutomationPointsInRange', () => {
    it('should return points within specified time range', async () => {
      // Create several test points
      await db.automation.setAutomationPoint(testParameterId, 40.0, 0.1);
      await db.automation.setAutomationPoint(testParameterId, 42.0, 0.3);
      await db.automation.setAutomationPoint(testParameterId, 44.0, 0.5);
      await db.automation.setAutomationPoint(testParameterId, 46.0, 0.7);
      
      // Get points in range
      const points = await db.automation.getAutomationPointsInRange(testParameterId, 41.0, 45.0);
      
      expect(points).toHaveLength(2);
      expect(points[0].timePosition).toBe(42.0);
      expect(points[1].timePosition).toBe(44.0);
      expect(points.map(p => p.value)).toEqual([0.3, 0.5]);
    });

    it('should return points sorted by time position', async () => {
      // Create points out of order
      await db.automation.setAutomationPoint(testParameterId, 52.0, 0.8);
      await db.automation.setAutomationPoint(testParameterId, 50.0, 0.2);
      await db.automation.setAutomationPoint(testParameterId, 51.0, 0.5);
      
      const points = await db.automation.getAutomationPointsInRange(testParameterId, 49.0, 53.0);
      
      expect(points).toHaveLength(3);
      expect(points.map(p => p.timePosition)).toEqual([50.0, 51.0, 52.0]);
    });
  });

  describe('bulkSetAutomationPoints', () => {
    it('should create multiple automation points efficiently', async () => {
      const bulkPoints = [
        { timePosition: 1000.0, value: 0.0 },
        { timePosition: 1001.0, value: 0.25 },
        { timePosition: 1002.0, value: 0.5 },
        { timePosition: 1003.0, value: 0.75 },
        { timePosition: 1004.0, value: 1.0 }
      ];
      
      const results = await db.automation.bulkSetAutomationPoints(testParameterId, bulkPoints);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.timePosition).toBe(bulkPoints[index].timePosition);
        expect(result.value).toBe(bulkPoints[index].value);
        expect(result.parameterId).toBe(testParameterId);
      });
      
      // Verify points were created in database with exact range
      const storedPoints = await db.automation.getAutomationPointsInRange(testParameterId, 999.5, 1004.5);
      expect(storedPoints).toHaveLength(5);
    });
  });

  describe('integration with existing automation', () => {
    it('should work with existing automation data from ALS file', async () => {
      // Get existing automation points
      const originalPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      const originalCount = originalPoints.length;
      
      expect(originalCount).toBeGreaterThan(0);
      
      // Add new points
      await db.automation.setAutomationPoint(testParameterId, 70.0, 0.33);
      await db.automation.setAutomationPoint(testParameterId, 71.0, 0.66);
      
      // Verify total count increased
      const updatedPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      expect(updatedPoints.length).toBe(originalCount + 2);
    });
  });
});
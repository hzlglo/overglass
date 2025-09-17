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
    const tracks = await db.tracks.getTracksForDevice(devices[0].id);
    const parameters = await db.tracks.getParametersForTrack(tracks[0].id);
    testParameterId = parameters[0].id;
    
    console.log(`Using test parameter: ${testParameterId} (${parameters[0].parameterName})`);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('createAutomationPoint', () => {
    it('should create a new automation point', async () => {
      const timePosition = 16.0; // 16 beats
      const value = 0.75;

      const result = await db.automation.createAutomationPoint(testParameterId, timePosition, value);

      expect(result).toMatchObject({
        parameterId: testParameterId,
        timePosition,
        value,
        id: expect.any(String)
      });

      expect(result.id).toBeTruthy();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });


    it('should validate automation values', async () => {
      await expect(
        db.automation.createAutomationPoint(testParameterId, 20.0, 1.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');

      await expect(
        db.automation.createAutomationPoint(testParameterId, 20.0, -0.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');
    });

    it('should reject invalid parameter IDs', async () => {
      await expect(
        db.automation.createAutomationPoint('invalid-parameter-id', 24.0, 0.5)
      ).rejects.toThrow('Parameter invalid-parameter-id not found');
    });
  });

  describe('updateAutomationPoint', () => {
    let testPointId: string;

    it('should update an existing automation point by id', async () => {
      // First create a point to update
      const originalPoint = await db.automation.createAutomationPoint(testParameterId, 22.0, 0.3);
      testPointId = originalPoint.id;

      // Now update it
      const newTimePosition = 24.0;
      const newValue = 0.8;

      const result = await db.automation.updateAutomationPoint(
        testPointId,
        testParameterId,
        newTimePosition,
        newValue
      );

      expect(result).toMatchObject({
        id: testPointId,
        parameterId: testParameterId,
        timePosition: newTimePosition,
        value: newValue
      });

      // Verify the point exists at new position with correct values
      const pointsAtNewTime = await db.automation.getAutomationPointsInRange(testParameterId, 23.9, 24.1);
      expect(pointsAtNewTime).toHaveLength(1);
      expect(pointsAtNewTime[0].value).toBe(newValue);
      expect(pointsAtNewTime[0].id).toBe(testPointId);
    });


    it('should preserve createdAt when updating', async () => {
      // Create a point
      const originalPoint = await db.automation.createAutomationPoint(testParameterId, 28.0, 0.5);
      const originalCreatedAt = originalPoint.createdAt;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update it
      const updatedPoint = await db.automation.updateAutomationPoint(
        originalPoint.id,
        testParameterId,
        30.0,
        0.9
      );

      expect(updatedPoint.createdAt).toEqual(originalCreatedAt);
      expect(updatedPoint.updatedAt).not.toEqual(originalCreatedAt);
    });

    it('should reject updates to non-existent points', async () => {
      await expect(
        db.automation.updateAutomationPoint('non-existent-id', testParameterId, 32.0, 0.5)
      ).rejects.toThrow('Automation point with id non-existent-id not found');
    });

    it('should validate automation values on update', async () => {
      const point = await db.automation.createAutomationPoint(testParameterId, 34.0, 0.5);

      await expect(
        db.automation.updateAutomationPoint(point.id, testParameterId, 34.0, 1.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');

      await expect(
        db.automation.updateAutomationPoint(point.id, testParameterId, 34.0, -0.5)
      ).rejects.toThrow('Automation value must be between 0.0 and 1.0');
    });
  });


  describe('removeAutomationPoint', () => {
    it('should remove an existing automation point', async () => {
      const timePosition = 32.0;
      
      // First create a point
      await db.automation.createAutomationPoint(testParameterId, timePosition, 0.8);
      
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
      await db.automation.createAutomationPoint(testParameterId, 40.0, 0.1);
      await db.automation.createAutomationPoint(testParameterId, 42.0, 0.3);
      await db.automation.createAutomationPoint(testParameterId, 44.0, 0.5);
      await db.automation.createAutomationPoint(testParameterId, 46.0, 0.7);
      
      // Get points in range
      const points = await db.automation.getAutomationPointsInRange(testParameterId, 41.0, 45.0);
      
      expect(points).toHaveLength(2);
      expect(points[0].timePosition).toBe(42.0);
      expect(points[1].timePosition).toBe(44.0);
      expect(points.map(p => p.value)).toEqual([0.3, 0.5]);
    });

    it('should return points sorted by time position', async () => {
      // Create points out of order
      await db.automation.createAutomationPoint(testParameterId, 52.0, 0.8);
      await db.automation.createAutomationPoint(testParameterId, 50.0, 0.2);
      await db.automation.createAutomationPoint(testParameterId, 51.0, 0.5);
      
      const points = await db.automation.getAutomationPointsInRange(testParameterId, 49.0, 53.0);
      
      expect(points).toHaveLength(3);
      expect(points.map(p => p.timePosition)).toEqual([50.0, 51.0, 52.0]);
    });
  });

  describe('bulkSetAutomationPoints', () => {
    it('should create multiple automation points efficiently', async () => {
      // Get 5 existing automation points from the database
      const existingPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      expect(existingPoints.length).toBeGreaterThanOrEqual(5);

      const pointsToUpdate = existingPoints.slice(0, 5);

      // Modify their values for the bulk update
      const bulkPoints = pointsToUpdate.map((point, index) => ({
        id: point.id,
        parameterId: point.parameterId,
        timePosition: point.timePosition,
        value: index * 0.2 // 0.0, 0.2, 0.4, 0.6, 0.8
      }));

      const results = await db.automation.bulkSetAutomationPoints(bulkPoints);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.timePosition).toBe(bulkPoints[index].timePosition);
        expect(result.value).toBe(bulkPoints[index].value);
        expect(result.parameterId).toBe(testParameterId);
        expect(result.id).toBe(bulkPoints[index].id);
      });

      // Verify points were updated in database
      const updatedPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      const updatedPointsById = updatedPoints.filter(p => bulkPoints.some(bp => bp.id === p.id));
      expect(updatedPointsById).toHaveLength(5);

      // Verify values were actually updated
      updatedPointsById.forEach(point => {
        const originalBulkPoint = bulkPoints.find(bp => bp.id === point.id);
        expect(point.value).toBe(originalBulkPoint?.value);
      });
    });
  });

  describe('integration with existing automation', () => {
    it('should work with existing automation data from ALS file', async () => {
      // Get existing automation points
      const originalPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      const originalCount = originalPoints.length;
      
      expect(originalCount).toBeGreaterThan(0);
      
      // Add new points
      await db.automation.createAutomationPoint(testParameterId, 70.0, 0.33);
      await db.automation.createAutomationPoint(testParameterId, 71.0, 0.66);
      
      // Verify total count increased
      const updatedPoints = await db.automation.getAutomationPointsInRange(testParameterId, -100, 100);
      expect(updatedPoints.length).toBe(originalCount + 2);
    });
  });
});
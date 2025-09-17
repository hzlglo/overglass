import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import type { ParsedALS } from '../lib/types/automation';

describe('DuckDB Schema Tests', () => {
  let database: AutomationDatabase;

  beforeEach(async () => {
    database = new AutomationDatabase(new NativeDuckDBAdapter());
    await database.initialize();
  });

  afterEach(async () => {
    if (database) {
      await database.close();
    }
  });

  it('should initialize database with correct schema', async () => {
    // Database should be initialized successfully (no errors)
    expect(database).toBeDefined();
  });

  it('should handle empty device queries', async () => {
    const devices = await database.devices.getDevicesWithTracks();
    expect(devices).toEqual([]);
  });

  it('should load minimal test data', async () => {
    // Create minimal test entities directly
    const testDevice = {
      id: 'test-device-1',
      deviceName: 'Test Device',
      deviceType: 'Elektron',
      createdAt: new Date()
    };

    const testTrack = {
      id: 'test-track-1',
      deviceId: 'test-device-1',
      trackName: 'Test Device Track 1',
      trackNumber: 1,
      isMuted: false,
      createdAt: new Date(),
      lastEditTime: new Date()
    };

    const testParameter = {
      id: 'test-param-1',
      trackId: 'test-track-1',
      parameterName: 'Volume',
      parameterPath: '/Test Device/Volume',
      originalPointeeId: null,
      createdAt: new Date()
    };

    const testAutomationPoint1 = {
      id: 'test-point-1',
      parameterId: 'test-param-1',
      timePosition: 0.0,
      value: 0.5,
      curveType: 'linear',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const testAutomationPoint2 = {
      id: 'test-point-2',
      parameterId: 'test-param-1',
      timePosition: 100.0,
      value: 0.8,
      curveType: 'linear',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert entities directly
    await database.insertRecord('devices', testDevice);
    await database.insertRecord('tracks', testTrack);
    await database.insertRecord('parameters', testParameter);
    await database.insertRecord('automation_points', testAutomationPoint1);
    await database.insertRecord('automation_points', testAutomationPoint2);

    const devices = await database.devices.getDevicesWithTracks();
    console.log('Devices result:', devices);
    expect(devices.length).toBe(1);
    expect(devices[0].deviceName).toBe('Test Device');
    expect(Number(devices[0].trackCount)).toBe(1);
    expect(Number(devices[0].parameterCount)).toBe(1);
    expect(Number(devices[0].automationPointCount)).toBe(2);
  });
});

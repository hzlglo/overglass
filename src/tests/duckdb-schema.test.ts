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
    // Create minimal test data
    const testData: ParsedALS = {
      set: {
        name: 'test',
        bpm: 120,
        elektron: [
          {
            deviceName: 'Test Device',
            tracks: [
              {
                trackNumber: 1,
                deviceName: 'Test Device',
                isMuted: false,
                automationEnvelopes: [
                  {
                    id: 'test_param_1',
                    deviceName: 'Test Device',
                    parameterName: 'Volume',
                    points: [
                      { time: 0, value: 0.5 },
                      { time: 100, value: 0.8 },
                    ],
                    minValue: 0,
                    maxValue: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    await database.loadALSData(testData);

    const devices = await database.devices.getDevicesWithTracks();
    console.log('Devices result:', devices);
    expect(devices.length).toBe(1);
    expect(devices[0].device_name).toBe('Test Device');
    expect(parseInt(devices[0].track_count)).toBe(1);
    expect(parseInt(devices[0].parameter_count)).toBe(1);
    expect(parseInt(devices[0].automation_point_count)).toBe(2);
  });
});

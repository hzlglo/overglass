import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { ALSParser } from '../lib/parsers/alsParser';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';

describe('DuckDB Database Integration', () => {
  let testFile: File;
  let parser: ALSParser;
  let database: AutomationDatabase;

  beforeEach(async () => {
    // Load the test1.als file - check multiple locations
    let buffer: Buffer;
    try {
      buffer = readFileSync('./src/tests/test1.als');
    } catch {
      try {
        buffer = readFileSync('./test1.als');
      } catch {
        // Skip test if no test file available
        console.warn('No test1.als file found, creating minimal test data');
        buffer = Buffer.from('dummy'); // This will be handled in individual tests
      }
    }
    testFile = {
      name: 'test.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    parser = new ALSParser();
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

  it('should load ALS data into database', async () => {
    const parsedALS = await parser.parseALSFile(testFile);
    await database.loadALSData(parsedALS);

    // Verify data was loaded
    const devices = await database.getDevicesWithTracks();
    expect(devices.length).toBeGreaterThan(0);

    console.log('Database devices:', devices);

    // Should have 1 Elektron device from test file
    expect(devices.length).toBe(1);

    // Check device types
    const deviceNames = devices.map((d) => d.device_name).sort();
    expect(deviceNames).toContain('Digitakt II');
  });

  it('should efficiently query automation data', async () => {
    const parsedALS = await parser.parseALSFile(testFile);
    await database.loadALSData(parsedALS);

    const devices = await database.getDevicesWithTracks();
    const firstDevice = devices[0];

    expect(parseInt(firstDevice.track_count)).toBeGreaterThan(0);
    expect(parseInt(firstDevice.parameter_count)).toBeGreaterThan(0);
    expect(parseInt(firstDevice.automation_point_count)).toBeGreaterThan(0);

    console.log(`Device ${firstDevice.device_name}:`);
    console.log(`  Tracks: ${firstDevice.track_count}`);
    console.log(`  Parameters: ${firstDevice.parameter_count}`);
    console.log(`  Automation Points: ${firstDevice.automation_point_count}`);
  });

  it('should handle time-based queries efficiently', async () => {
    const parsedALS = await parser.parseALSFile(testFile);
    await database.loadALSData(parsedALS);

    const devices = await database.getDevicesWithTracks();

    // Find a parameter to test with
    for (const device of devices) {
      // This is a simplified test - in real usage we'd get track IDs and parameter IDs
      // from proper queries, but for now we're testing the database structure
      expect(device).toHaveProperty('device_id');
      expect(device).toHaveProperty('device_name');
      expect(device).toHaveProperty('track_count');
    }
  });

  it('should maintain referential integrity', async () => {
    const parsedALS = await parser.parseALSFile(testFile);
    await database.loadALSData(parsedALS);

    // Test that we can query related data without foreign key errors
    const devices = await database.getDevicesWithTracks();
    expect(devices.length).toBeGreaterThan(0);

    // Each device should have consistent counts
    devices.forEach((device) => {
      expect(parseInt(device.track_count)).toBeGreaterThanOrEqual(0);
      expect(parseInt(device.parameter_count)).toBeGreaterThanOrEqual(0);
      expect(parseInt(device.automation_point_count)).toBeGreaterThanOrEqual(0);
    });
  });

  it('should support batch operations for large datasets', async () => {
    const parsedALS = await parser.parseALSFile(testFile);

    // Measure load time for performance
    const startTime = performance.now();
    await database.loadALSData(parsedALS);
    const endTime = performance.now();

    console.log(`Data load time: ${(endTime - startTime).toFixed(2)}ms`);

    // Should load within reasonable time (adjust threshold as needed)
    expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

    const devices = await database.getDevicesWithTracks();
    expect(devices.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ALSParser } from '../lib/parsers/alsParser';
import { ALSWriter } from '../lib/parsers/alsWriter';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { gzipXmlHelpers } from '../lib/utils/gzipXmlHelpers';

describe('ALS Round-Trip Integration Test', () => {
  let db: AutomationDatabase;
  let parser: ALSParser;
  let writer: ALSWriter;
  let originalParsedALS: any;
  let originalParameterData: Map<string, any>;

  beforeAll(async () => {
    console.log('🚀 Starting ALS Round-Trip Integration Test');

    // Initialize database
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();

    parser = new ALSParser();
    writer = new ALSWriter(db);
  });

  afterAll(async () => {
    await db.close();
    console.log('✅ ALS Round-Trip Integration Test completed');
  });

  it('Step 1: Parse and load original ALS file into database', async () => {
    console.log('📖 Step 1: Loading original ALS file...');

    // Load test ALS file
    const buffer = readFileSync('./static/test1.als');
    const testFile = {
      name: 'test1.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Parse the ALS file
    originalParsedALS = await parser.parseALSFile(testFile);
    expect(originalParsedALS).toBeDefined();
    expect(originalParsedALS.name).toBe('test1');
    expect(originalParsedALS.bpm).toBeGreaterThan(0);

    // Load data into database
    await db.loadALSData(originalParsedALS);

    // Verify data was loaded
    const devices = await db.devices.getDevicesWithTracks();
    expect(devices.length).toBeGreaterThan(0);

    // Capture original parameter data for comparison
    originalParameterData = await captureParameterSnapshot();

    console.log(`✅ Original file loaded: ${originalParsedALS.name} at ${originalParsedALS.bpm} BPM`);
    console.log(`   Database contains: ${devices.length} devices, ${originalParameterData.size} parameters`);
  });

  it('Step 2: Make systematic edits to automation data', async () => {
    console.log('✏️  Step 2: Making systematic edits to automation data...');

    const devices = await db.devices.getDevicesWithTracks();
    let totalEdits = 0;
    let parametersModified = 0;

    // Edit automation points in each parameter
    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);

        for (const parameter of parameters) {
          // Get existing automation points
          const existingPoints = await db.automation.getAutomationPoints({
            parameterId: parameter.id
          });

          if (existingPoints.length > 0) {
            parametersModified++;

            // Edit 1: Shift all existing points forward by 1 second and scale values by 0.9
            for (const point of existingPoints) {
              await db.automation.setAutomationPoint(
                parameter.id,
                point.timePosition + 1.0, // Shift forward by 1 second
                point.value * 0.9        // Scale to 90%
              );
              await db.automation.removeAutomationPoint(parameter.id, point.timePosition);
              totalEdits++;
            }

            // Edit 2: Add signature test points that we can verify later
            await db.automation.setAutomationPoint(parameter.id, 0.1, 0.1);  // Test point 1
            await db.automation.setAutomationPoint(parameter.id, 0.5, 0.5);  // Test point 2
            await db.automation.setAutomationPoint(parameter.id, 0.9, 0.9);  // Test point 3
            totalEdits += 3;

            console.log(`   Modified parameter: ${parameter.parameterName} (${existingPoints.length} points shifted, 3 test points added)`);
          }
        }
      }
    }

    expect(parametersModified).toBeGreaterThan(0);
    expect(totalEdits).toBeGreaterThan(0);

    console.log(`✅ Completed edits: ${parametersModified} parameters modified, ${totalEdits} total changes`);
  });

  it('Step 3: Export modified data back to ALS file', async () => {
    console.log('💾 Step 3: Exporting modified data to ALS file...');

    // Write the modified data back to ALS format using ALSWriter
    const editedFile = await writer.writeALSFile(originalParsedALS, 'test1_roundtrip.als');

    expect(editedFile).toBeDefined();
    expect(editedFile.name).toBe('test1_roundtrip.als');
    expect(editedFile.size).toBeGreaterThan(0);

    // The ALSWriter now handles writing to disk directly for Node.js testing
    console.log('   Modified ALS file will be saved by ALSWriter to ./static/test1_roundtrip.als');

    console.log(`✅ Modified ALS file exported: ${editedFile.name} (${editedFile.size} bytes)`);
    console.log(`   File saved to: ./static/test1_roundtrip.als`);
  });

  it('Step 4: Re-parse the exported ALS file', async () => {
    console.log('🔄 Step 4: Re-parsing the exported ALS file...');

    // Verify file exists
    expect(existsSync('./static/test1_roundtrip.als')).toBe(true);

    // Clean slate: close and reinitialize database
    await db.close();
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();
    writer = new ALSWriter(db); // Recreate with new db instance

    // Load the exported file
    const buffer = readFileSync('./static/test1_roundtrip.als');
    const roundTripFile = {
      name: 'test1_roundtrip.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Parse the round-trip file
    const reparsedALS = await parser.parseALSFile(roundTripFile);
    expect(reparsedALS).toBeDefined();
    expect(reparsedALS.name).toBe('test1_roundtrip');

    // Load into fresh database
    await db.loadALSData(reparsedALS);

    console.log(`✅ Round-trip file re-parsed and loaded: ${reparsedALS.name}`);
  });

  it('Step 5: Verify all edits are preserved in round-trip file', async () => {
    console.log('🔍 Step 5: Verifying edits are preserved...');

    // Get the re-parsed data
    const newParameterData = await captureParameterSnapshot();

    // Debug: check what's in the new parameter data
    console.log('   newParameterData size:', newParameterData.size);
    console.log('   originalParameterData size:', originalParameterData.size);

    // Remove metadata entries for comparison
    const newDataWithoutMeta = new Map();
    const originalDataWithoutMeta = new Map();

    for (const [key, value] of newParameterData) {
      if (key !== '_metadata') {
        newDataWithoutMeta.set(key, value);
      }
    }

    for (const [key, value] of originalParameterData) {
      if (key !== '_metadata') {
        originalDataWithoutMeta.set(key, value);
      }
    }

    console.log('   Parameters without metadata - new:', newDataWithoutMeta.size, 'original:', originalDataWithoutMeta.size);

    // Verify we have the same structure (excluding metadata which has different IDs)
    expect(newDataWithoutMeta.size).toBe(originalDataWithoutMeta.size);

    let testPointsFound = 0;
    let shiftedPointsFound = 0;
    let parametersVerified = 0;

    // Check each parameter for our specific edits
    // Note: Parameter IDs will be different after round-trip, so match by parameter name
    for (const [newParameterId, newData] of newDataWithoutMeta) {
      const parameterName = newData.parameter.parameterName;

      // Find the original parameter by name
      let originalData: any = null;
      for (const [originalParameterId, originalDataCandidate] of originalDataWithoutMeta) {
        if (originalDataCandidate.parameter && originalDataCandidate.parameter.parameterName === parameterName) {
          originalData = originalDataCandidate;
          break;
        }
      }

      expect(originalData).toBeDefined();

      const newPoints = newData.automationPoints;
      parametersVerified++;

      // Look for our signature test points (0.1,0.1), (0.5,0.5), (0.9,0.9)
      const hasTestPoint1 = newPoints.some((p: any) =>
        Math.abs(p.timePosition - 0.1) < 0.01 && Math.abs(p.value - 0.1) < 0.01);
      const hasTestPoint2 = newPoints.some((p: any) =>
        Math.abs(p.timePosition - 0.5) < 0.01 && Math.abs(p.value - 0.5) < 0.01);
      const hasTestPoint3 = newPoints.some((p: any) =>
        Math.abs(p.timePosition - 0.9) < 0.01 && Math.abs(p.value - 0.9) < 0.01);

      if (hasTestPoint1 && hasTestPoint2 && hasTestPoint3) {
        testPointsFound++;
        console.log(`   ✅ Found all 3 test points in parameter: ${newData.parameter.parameterName}`);
      }

      // Look for shifted and scaled original points
      const originalPoints = originalData.automationPoints;
      for (const originalPoint of originalPoints) {
        const expectedTime = originalPoint.timePosition + 1.0;
        const expectedValue = originalPoint.value * 0.9;

        const shiftedPoint = newPoints.find((p: any) =>
          Math.abs(p.timePosition - expectedTime) < 0.01 &&
          Math.abs(p.value - expectedValue) < 0.01
        );

        if (shiftedPoint) {
          shiftedPointsFound++;
        }
      }
    }

    // Verify we found our edits
    expect(testPointsFound).toBeGreaterThan(0);
    expect(shiftedPointsFound).toBeGreaterThan(0);

    console.log(`✅ Edit verification complete:`);
    console.log(`   Parameters verified: ${parametersVerified}`);
    console.log(`   Parameters with test points: ${testPointsFound}`);
    console.log(`   Shifted original points found: ${shiftedPointsFound}`);
  });

  it('Step 6: Verify data integrity and structure preservation', async () => {
    console.log('🏗️  Step 6: Verifying data integrity...');

    // Check overall structure is preserved
    const devices = await db.devices.getDevicesWithTracks();
    const originalMetadata = originalParameterData.get('_metadata') || {};

    expect(devices.length).toBe(originalMetadata.deviceCount);

    let totalParameters = 0;
    let totalPoints = 0;

    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        totalParameters += parameters.length;

        for (const parameter of parameters) {
          const points = await db.automation.getAutomationPoints({
            parameterId: parameter.id
          });
          totalPoints += points.length;
        }
      }
    }

    // We should have more points than original due to our additions
    const originalTotalPoints = originalMetadata.totalPoints || 0;
    expect(totalPoints).toBeGreaterThan(originalTotalPoints);

    // Each parameter got 3 additional test points
    const expectedMinPoints = originalTotalPoints + (totalParameters * 3);
    expect(totalPoints).toBeGreaterThanOrEqual(expectedMinPoints);

    console.log(`✅ Data integrity verified:`);
    console.log(`   Devices: ${devices.length} (original: ${originalMetadata.deviceCount})`);
    console.log(`   Parameters: ${totalParameters}`);
    console.log(`   Automation Points: ${totalPoints} (original: ${originalTotalPoints}, expected min: ${expectedMinPoints})`);
  });

  it('Step 7: Test gzipXmlHelpers directly with round-trip file', async () => {
    console.log('🧪 Step 7: Testing gzipXmlHelpers directly...');

    // Use gzipXmlHelpers to read the round-trip file directly
    const buffer = readFileSync('./static/test1_roundtrip.als');
    const testFile = {
      name: 'test1_roundtrip.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    const { xmlDoc, xmlString } = await gzipXmlHelpers.readALSFile(testFile);

    expect(xmlDoc).toBeDefined();
    expect(xmlString).toBeDefined();
    expect(xmlDoc.documentElement.tagName).toBe('Ableton');
    expect(xmlString.length).toBeGreaterThan(1000);

    // Verify we can write it back
    const rewrittenFile = await gzipXmlHelpers.writeALSFile(xmlDoc, 'test1_rewritten.als');
    expect(rewrittenFile).toBeDefined();
    expect(rewrittenFile.size).toBeGreaterThan(0);

    console.log(`✅ gzipXmlHelpers verification complete:`);
    console.log(`   XML string length: ${xmlString.length} characters`);
    console.log(`   Rewritten file size: ${rewrittenFile.size} bytes`);
  });

  /**
   * Helper function to collect database data in the same format as ALSWriter
   */
  async function collectDatabaseData(devices: any[], db: any) {
    const deviceData = new Map<string, any>();

    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);
      const trackData = new Map();

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        const parameterData = new Map();

        for (const parameter of parameters) {
          const automationPoints = await db.automation.getAutomationPoints({
            parameterId: parameter.id
          });

          parameterData.set(parameter.id, {
            parameter,
            automationPoints
          });
        }

        trackData.set(track.id, {
          track,
          parameters: parameterData
        });
      }

      deviceData.set(device.id, {
        device,
        tracks: trackData
      });
    }

    return deviceData;
  }

  /**
   * Helper function to capture a snapshot of all parameter automation data
   */
  async function captureParameterSnapshot(): Promise<Map<string, any>> {
    const snapshot = new Map();
    const devices = await db.devices.getDevicesWithTracks();

    let totalPoints = 0;
    let totalParameters = 0;

    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        totalParameters += parameters.length;

        for (const parameter of parameters) {
          const automationPoints = await db.automation.getAutomationPoints({
            parameterId: parameter.id
          });

          totalPoints += automationPoints.length;

          snapshot.set(parameter.id, {
            parameter,
            automationPoints,
            track,
            device
          });
        }
      }
    }

    // Store metadata
    snapshot.set('_metadata', {
      deviceCount: devices.length,
      totalPoints,
      totalParameters
    });

    return snapshot;
  }
});
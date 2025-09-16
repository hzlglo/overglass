import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { ALSParser } from '../lib/parsers/alsParser';
import { ALSWriter } from '../lib/parsers/alsWriter';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';

describe('ALS Round-Trip Testing', () => {
  let db: AutomationDatabase;
  let parser: ALSParser;
  let writer: ALSWriter;
  let originalParsedALS: any;
  let originalAutomationData: Map<string, any>;

  beforeAll(async () => {
    // Initialize database
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();

    parser = new ALSParser();
    writer = new ALSWriter(db);

    console.log('🎵 Starting ALS Round-Trip Test');
  });

  afterAll(async () => {
    await db.close();
    console.log('✅ ALS Round-Trip Test completed');
  });

  it('Step 1: Parse original ALS file', async () => {
    console.log('📖 Step 1: Parsing original ALS file...');

    // Load test ALS file
    const buffer = readFileSync('./src/tests/test1.als');
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

    // Capture original automation data for comparison
    originalAutomationData = await captureAutomationSnapshot();

    console.log(`✅ Original file parsed: ${originalParsedALS.name} at ${originalParsedALS.bpm} BPM`);
    console.log(`   Database loaded with ${originalAutomationData.size} parameters`);
  });

  it('Step 2: Make edits to automation data', async () => {
    console.log('✏️  Step 2: Making edits to automation data...');

    // Get some parameters to edit
    const devices = await db.devices.getDevicesWithTracks();
    expect(devices.length).toBeGreaterThan(0);

    const tracks = await db.tracks.getTracksForDevice(devices[0].id);
    expect(tracks.length).toBeGreaterThan(0);

    let totalEdits = 0;

    // Edit automation points in multiple parameters
    for (const track of tracks) {
      const parameters = await db.tracks.getParametersForTrack(track.id);

      for (const parameter of parameters) {
        // Get existing automation points
        const existingPoints = await db.automation.getAutomationPoints({
          parameterId: parameter.id
        });

        if (existingPoints.length > 0) {
          // Edit 1: Move all points forward by 2 seconds
          for (const point of existingPoints) {
            await db.automation.setAutomationPoint(
              parameter.id,
              point.timePosition + 2.0, // Move forward by 2 seconds
              point.value * 0.8 // Also scale the value to 80%
            );
            await db.automation.removeAutomationPoint(parameter.id, point.timePosition);
          }

          // Edit 2: Add new automation points at specific times
          await db.automation.setAutomationPoint(parameter.id, 0.5, 0.25);
          await db.automation.setAutomationPoint(parameter.id, 1.0, 0.75);

          totalEdits++;
          console.log(`   Edited parameter: ${parameter.parameterName} (moved ${existingPoints.length} points, added 2 new points)`);
        }
      }
    }

    expect(totalEdits).toBeGreaterThan(0);
    console.log(`✅ Made edits to ${totalEdits} parameters`);
  });

  it('Step 3: Write edited data back to ALS file', async () => {
    console.log('💾 Step 3: Writing edited data back to ALS file...');

    // Write the modified data back to ALS format
    const editedALSFile = await writer.writeALSFile(originalParsedALS, 'test1_edited.als');

    expect(editedALSFile).toBeDefined();
    expect(editedALSFile.name).toBe('test1_edited.als');
    expect(editedALSFile.size).toBeGreaterThan(0);

    // Save to disk for inspection (optional)
    // Convert File to Buffer for Node.js
    const blob = editedALSFile as any;
    const buffer = Buffer.from(await blob.arrayBuffer());
    writeFileSync('./src/tests/test1_edited.als', buffer);

    console.log(`✅ Edited ALS file created: ${editedALSFile.name} (${editedALSFile.size} bytes)`);
  });

  it('Step 4: Parse the edited ALS file', async () => {
    console.log('📖 Step 4: Parsing the edited ALS file...');

    // Clear database and load edited file
    await db.close();

    // Reinitialize database
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();
    writer = new ALSWriter(db); // Recreate writer with new db

    // Load the edited file
    const buffer = readFileSync('./src/tests/test1_edited.als');
    const editedFile = {
      name: 'test1_edited.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Parse the edited ALS file
    const reparsedALS = await parser.parseALSFile(editedFile);
    expect(reparsedALS).toBeDefined();
    expect(reparsedALS.name).toBe('test1_edited.als');

    // Load into database
    await db.loadALSData(reparsedALS);

    console.log(`✅ Edited file re-parsed: ${reparsedALS.name}`);
  });

  it('Step 5: Verify edits are preserved', async () => {
    console.log('🔍 Step 5: Verifying edits are preserved...');

    // Get the re-parsed automation data
    const newAutomationData = await captureAutomationSnapshot();

    // Verify we have the same number of parameters
    expect(newAutomationData.size).toBe(originalAutomationData.size);

    let verificationsCount = 0;
    let editedParametersFound = 0;

    // Check each parameter for expected edits
    for (const [parameterId, newData] of newAutomationData) {
      const originalData = originalAutomationData.get(parameterId);
      expect(originalData).toBeDefined();

      // Verify edits are present
      const newPoints = newData.automationPoints;
      const originalPoints = originalData.automationPoints;

      // Check for our specific edits
      const hasNewPointAt0_5 = newPoints.some((p: any) => Math.abs(p.timePosition - 0.5) < 0.01 && Math.abs(p.value - 0.25) < 0.01);
      const hasNewPointAt1_0 = newPoints.some((p: any) => Math.abs(p.timePosition - 1.0) < 0.01 && Math.abs(p.value - 0.75) < 0.01);

      if (hasNewPointAt0_5 && hasNewPointAt1_0) {
        editedParametersFound++;
        console.log(`   ✅ Found expected edits in parameter: ${newData.parameter.parameterName}`);
      }

      // Check that original points were moved forward by 2 seconds and scaled to 80%
      for (const originalPoint of originalPoints) {
        const expectedTime = originalPoint.timePosition + 2.0;
        const expectedValue = originalPoint.value * 0.8;

        const movedPoint = newPoints.find((p: any) =>
          Math.abs(p.timePosition - expectedTime) < 0.01 &&
          Math.abs(p.value - expectedValue) < 0.01
        );

        if (movedPoint) {
          verificationsCount++;
        }
      }
    }

    expect(editedParametersFound).toBeGreaterThan(0);
    expect(verificationsCount).toBeGreaterThan(0);

    console.log(`✅ Verified edits in ${editedParametersFound} parameters`);
    console.log(`✅ Verified ${verificationsCount} moved/scaled automation points`);
  });

  it('Step 6: Verify data integrity', async () => {
    console.log('🔍 Step 6: Verifying overall data integrity...');

    // Check that basic structure is preserved
    const devices = await db.devices.getDevicesWithTracks();
    const originalDevices = originalAutomationData.get('_metadata')?.deviceCount || 0;

    expect(devices.length).toBe(originalDevices);

    let totalParametersAfter = 0;
    let totalPointsAfter = 0;

    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);
        totalParametersAfter += parameters.length;

        for (const parameter of parameters) {
          const points = await db.automation.getAutomationPoints({
            parameterId: parameter.id
          });
          totalPointsAfter += points.length;
        }
      }
    }

    const originalTotalPoints = originalAutomationData.get('_metadata')?.totalPoints || 0;

    // We added 2 new points per parameter and moved existing ones
    const expectedMinPoints = originalTotalPoints + (totalParametersAfter * 2);
    expect(totalPointsAfter).toBeGreaterThanOrEqual(expectedMinPoints);

    console.log(`✅ Data integrity verified:`);
    console.log(`   Devices: ${devices.length}`);
    console.log(`   Parameters: ${totalParametersAfter}`);
    console.log(`   Automation Points: ${totalPointsAfter} (original: ${originalTotalPoints})`);
  });

  /**
   * Helper function to capture a snapshot of all automation data
   */
  async function captureAutomationSnapshot(): Promise<Map<string, any>> {
    const snapshot = new Map();
    const devices = await db.devices.getDevicesWithTracks();

    let totalPoints = 0;

    for (const device of devices) {
      const tracks = await db.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await db.tracks.getParametersForTrack(track.id);

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
      totalPoints
    });

    return snapshot;
  }
});
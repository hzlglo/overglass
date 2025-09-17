import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ALSParser } from '../lib/parsers/alsParser';
import { ALSWriter } from '../lib/parsers/alsWriter';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { gzipXmlHelpers } from '../lib/utils/gzipXmlHelpers';

interface EditScenario {
  name: string;
  description: string;
  applyEdits: (db: AutomationDatabase) => Promise<{
    editCount: number;
    parametersModified: number;
    description: string;
  }>;
  verifyEdits: (originalData: Map<string, any>, newData: Map<string, any>) => Promise<{
    verified: boolean;
    details: string;
  }>;
}

describe('ALS Round-Trip Integration Test', () => {
  let originalDb: AutomationDatabase;
  let roundTripDb: AutomationDatabase;
  let parser: ALSParser;
  let writer: ALSWriter;
  let originalParsedALS: any;
  let testOutputDir: string;

  // Test data directories
  const setupTestDir = () => {
    testOutputDir = './test_output';
    if (!existsSync(testOutputDir)) {
      mkdirSync(testOutputDir, { recursive: true });
    }
  };

  const cleanupTestFiles = () => {
    if (existsSync(testOutputDir)) {
      const fs = require('fs');
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        if (file.endsWith('.db') || file.endsWith('.wal') || file.endsWith('.db-journal')) {
          try {
            fs.unlinkSync(join(testOutputDir, file));
          } catch (err) {
            // Ignore errors, file might be in use
          }
        }
      }
    }
  };

  // Helper: Create a file-based database for comparison
  const createFileDatabaseForScenario = async (scenario: EditScenario, suffix: string) => {
    const filePath = join(testOutputDir, `${scenario.name}_${suffix}.db`);

    // Delete the file if it already exists to ensure we start fresh
    if (existsSync(filePath)) {
      const fs = require('fs');
      fs.unlinkSync(filePath);
    }

    const adapter = new NativeDuckDBAdapter(filePath);
    const db = new AutomationDatabase(adapter);
    await db.initialize();
    return { db, filePath };
  };

  // Helper: Compare two databases using DuckDB EXCEPT queries
  const compareDatabases = async (originalFile: string, roundTripFile: string) => {
    // Create a raw DuckDB instance for comparison
    const comparisonAdapter = new NativeDuckDBAdapter();
    await comparisonAdapter.initialize();

    try {
      // Attach both databases
      console.log(`Attaching original database: ${originalFile}`);
      await comparisonAdapter.execute(`ATTACH '${originalFile}' AS original`);

      console.log(`Attaching round-trip database: ${roundTripFile}`);
      await comparisonAdapter.execute(`ATTACH '${roundTripFile}' AS roundtrip`);

      const differences = {
        devices: { onlyInOriginal: [], onlyInRoundTrip: [] },
        tracks: { onlyInOriginal: [], onlyInRoundTrip: [] },
        parameters: { onlyInOriginal: [], onlyInRoundTrip: [] },
        automationPoints: { onlyInOriginal: [], onlyInRoundTrip: [] }
      };

      // Compare devices (excluding timestamps)
      differences.devices.onlyInOriginal = await comparisonAdapter.execute(`
        SELECT device_name, device_type FROM original.devices
        EXCEPT
        SELECT device_name, device_type FROM roundtrip.devices
      `);

      differences.devices.onlyInRoundTrip = await comparisonAdapter.execute(`
        SELECT device_name, device_type FROM roundtrip.devices
        EXCEPT
        SELECT device_name, device_type FROM original.devices
      `);

      // Compare tracks (excluding timestamps and IDs)
      differences.tracks.onlyInOriginal = await comparisonAdapter.execute(`
        SELECT track_number, track_name, is_muted FROM original.tracks
        EXCEPT
        SELECT track_number, track_name, is_muted FROM roundtrip.tracks
      `);

      differences.tracks.onlyInRoundTrip = await comparisonAdapter.execute(`
        SELECT track_number, track_name, is_muted FROM roundtrip.tracks
        EXCEPT
        SELECT track_number, track_name, is_muted FROM original.tracks
      `);

      // Compare parameters (excluding timestamps and IDs)
      differences.parameters.onlyInOriginal = await comparisonAdapter.execute(`
        SELECT parameter_name, parameter_path FROM original.parameters
        EXCEPT
        SELECT parameter_name, parameter_path FROM roundtrip.parameters
      `);

      differences.parameters.onlyInRoundTrip = await comparisonAdapter.execute(`
        SELECT parameter_name, parameter_path FROM roundtrip.parameters
        EXCEPT
        SELECT parameter_name, parameter_path FROM original.parameters
      `);

      // Compare automation points by parameter name and values (not IDs)
      differences.automationPoints.onlyInOriginal = await comparisonAdapter.execute(`
        SELECT p.parameter_name, ap.time_position, ap.value, ap.curve_type
        FROM original.automation_points ap
        JOIN original.parameters p ON ap.parameter_id = p.id
        EXCEPT
        SELECT rtp.parameter_name, rtap.time_position, rtap.value, rtap.curve_type
        FROM roundtrip.automation_points rtap
        JOIN roundtrip.parameters rtp ON rtap.parameter_id = rtp.id
      `);

      differences.automationPoints.onlyInRoundTrip = await comparisonAdapter.execute(`
        SELECT rtp.parameter_name, rtap.time_position, rtap.value, rtap.curve_type
        FROM roundtrip.automation_points rtap
        JOIN roundtrip.parameters rtp ON rtap.parameter_id = rtp.id
        EXCEPT
        SELECT p.parameter_name, ap.time_position, ap.value, ap.curve_type
        FROM original.automation_points ap
        JOIN original.parameters p ON ap.parameter_id = p.id
      `);

      return differences;
    } finally {
      await comparisonAdapter.close();
    }
  };

  // Helper: Run full round-trip test with specific edit scenario
  const runRoundTripTest = async (scenario: EditScenario) => {
    console.log(`\n🧪 Testing scenario: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);

    // Clean up any existing test files for this scenario
    cleanupTestFiles();

    // Step 1: Create file-based databases for testing
    const { db: originalDb, filePath: originalFile } = await createFileDatabaseForScenario(scenario, 'original');
    const { db: roundTripDb, filePath: roundTripFile } = await createFileDatabaseForScenario(scenario, 'roundtrip');

    try {
      // Step 2: Load original ALS file into original database
      const buffer = readFileSync('./static/test1.als');
      const testFile = {
        name: 'test1.als',
        size: buffer.length,
        type: 'application/octet-stream',
        arrayBuffer: async () =>
          buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      } as File;

      originalParsedALS = await parser.parseALSFile(testFile);
      await originalDb.loadALSData(originalParsedALS);

      // Capture original data before edits
      const originalData = await captureParameterSnapshot(originalDb);

      // Step 3: Apply scenario edits to original database
      const editResults = await scenario.applyEdits(originalDb);
      console.log(`   Applied edits: ${editResults.description}`);

      // Step 4: Export edited database to ALS file
      writer = new ALSWriter(originalDb);
      const editedFileName = `test1_${scenario.name}.als`;
      const editedFile = await writer.writeALSFile(originalParsedALS, editedFileName);

      // Step 5: Parse the exported ALS file into round-trip database
      const roundTripBuffer = readFileSync(join('./static', editedFileName));
      const roundTripFile2 = {
        name: editedFileName,
        size: roundTripBuffer.length,
        type: 'application/octet-stream',
        arrayBuffer: async () =>
          roundTripBuffer.buffer.slice(roundTripBuffer.byteOffset, roundTripBuffer.byteOffset + roundTripBuffer.byteLength),
      } as File;

      const reparsedALS = await parser.parseALSFile(roundTripFile2);
      await roundTripDb.loadALSData(reparsedALS);

      // Step 6: Close databases to ensure file writes are flushed
      await originalDb.close();
      await roundTripDb.close();

      // Step 7: Compare the two database files using ATTACH
      const differences = await compareDatabases(originalFile, roundTripFile);

      // Step 8: Verify scenario-specific expectations
      // Reopen round-trip database for verification (skip initialization since tables exist)
      const verificationAdapter = new NativeDuckDBAdapter(roundTripFile);
      const verificationDb = new AutomationDatabase(verificationAdapter);

      // Only initialize the adapter, skip the table creation since they already exist
      await verificationAdapter.initialize();
      // Manually set the database as initialized to skip schema creation
      verificationDb['isInitialized'] = true;

      const roundTripData = await captureParameterSnapshot(verificationDb);
      const verificationResults = await scenario.verifyEdits(originalData, roundTripData);

      console.log(`   Verification: ${verificationResults.details}`);

      await verificationDb.close();

      return {
        editResults,
        differences,
        verificationResults
      };
    } catch (error) {
      // Clean up on error
      await originalDb.close();
      await roundTripDb.close();
      throw error;
    }
  };

  // Define edit scenarios
  const editScenarios: EditScenario[] = [
    {
      name: 'add_points',
      description: 'Add new automation points to existing parameters',
      applyEdits: async (db) => {
        const devices = await db.devices.getDevicesWithTracks();
        let editCount = 0;
        let parametersModified = 0;

        for (const device of devices) {
          const tracks = await db.tracks.getTracksForDevice(device.id);
          for (const track of tracks) {
            const parameters = await db.tracks.getParametersForTrack(track.id);
            for (const parameter of parameters) {
              const existingPoints = await db.automation.getAutomationPoints({
                parameterId: parameter.id
              });

              if (existingPoints.length > 0) {
                // Add signature test points
                await db.automation.setAutomationPoint(parameter.id, 0.25, 0.25);
                await db.automation.setAutomationPoint(parameter.id, 0.75, 0.75);
                editCount += 2;
                parametersModified++;
                break; // Only modify first parameter with existing points per track
              }
            }
          }
        }

        return {
          editCount,
          parametersModified,
          description: `Added ${editCount} points to ${parametersModified} parameters`
        };
      },
      verifyEdits: async (originalData, newData) => {
        let testPointsFound = 0;
        for (const [parameterId, paramData] of newData) {
          if (parameterId === '_metadata') continue;
          const points = paramData.automationPoints;
          const hasTestPoint1 = points.some((p: any) =>
            Math.abs(p.timePosition - 0.25) < 0.01 && Math.abs(p.value - 0.25) < 0.01);
          const hasTestPoint2 = points.some((p: any) =>
            Math.abs(p.timePosition - 0.75) < 0.01 && Math.abs(p.value - 0.75) < 0.01);

          if (hasTestPoint1 && hasTestPoint2) {
            testPointsFound++;
          }
        }

        return {
          verified: testPointsFound > 0,
          details: `Found test points in ${testPointsFound} parameters`
        };
      }
    },
    {
      name: 'remove_points',
      description: 'Remove existing automation points',
      applyEdits: async (db) => {
        const devices = await db.devices.getDevicesWithTracks();
        let editCount = 0;
        let parametersModified = 0;

        for (const device of devices) {
          const tracks = await db.tracks.getTracksForDevice(device.id);
          for (const track of tracks) {
            const parameters = await db.tracks.getParametersForTrack(track.id);
            for (const parameter of parameters) {
              const existingPoints = await db.automation.getAutomationPoints({
                parameterId: parameter.id
              });

              if (existingPoints.length > 2) {
                // Remove the first point
                const firstPoint = existingPoints[0];
                await db.automation.removeAutomationPoint(parameter.id, firstPoint.timePosition);
                editCount++;
                parametersModified++;
                break; // Only modify first suitable parameter per track
              }
            }
          }
        }

        return {
          editCount,
          parametersModified,
          description: `Removed ${editCount} points from ${parametersModified} parameters`
        };
      },
      verifyEdits: async (originalData, newData) => {
        let pointsRemoved = 0;
        for (const [parameterId, originalParamData] of originalData) {
          if (parameterId === '_metadata') continue;

          const newParamData = newData.get(parameterId);
          if (!newParamData) continue;

          const originalPoints = originalParamData.automationPoints.length;
          const newPoints = newParamData.automationPoints.length;

          if (newPoints < originalPoints) {
            pointsRemoved += (originalPoints - newPoints);
          }
        }

        return {
          verified: pointsRemoved > 0,
          details: `Verified ${pointsRemoved} points were removed`
        };
      }
    },
    {
      name: 'modify_values',
      description: 'Change values of existing automation points',
      applyEdits: async (db) => {
        const devices = await db.devices.getDevicesWithTracks();
        let editCount = 0;
        let parametersModified = 0;

        for (const device of devices) {
          const tracks = await db.tracks.getTracksForDevice(device.id);
          for (const track of tracks) {
            const parameters = await db.tracks.getParametersForTrack(track.id);
            for (const parameter of parameters) {
              const existingPoints = await db.automation.getAutomationPoints({
                parameterId: parameter.id
              });

              if (existingPoints.length > 0) {
                // Modify values of existing points by multiplying by 0.8
                for (const point of existingPoints) {
                  const newValue = Math.max(0, Math.min(1, point.value * 0.8));
                  await db.automation.setAutomationPoint(parameter.id, point.timePosition, newValue);
                  editCount++;
                }
                parametersModified++;
                break; // Only modify first parameter with points per track
              }
            }
          }
        }

        return {
          editCount,
          parametersModified,
          description: `Modified ${editCount} point values in ${parametersModified} parameters`
        };
      },
      verifyEdits: async (originalData, newData) => {
        let valuesModified = 0;
        for (const [parameterId, originalParamData] of originalData) {
          if (parameterId === '_metadata') continue;

          const newParamData = newData.get(parameterId);
          if (!newParamData) continue;

          const originalPoints = originalParamData.automationPoints;
          const newPoints = newParamData.automationPoints;

          for (const originalPoint of originalPoints) {
            const matchingNewPoint = newPoints.find((np: any) =>
              Math.abs(np.timePosition - originalPoint.timePosition) < 0.001);

            if (matchingNewPoint && Math.abs(matchingNewPoint.value - (originalPoint.value * 0.8)) < 0.001) {
              valuesModified++;
            }
          }
        }

        return {
          verified: valuesModified > 0,
          details: `Verified ${valuesModified} point values were modified correctly`
        };
      }
    }
  ];

  beforeAll(async () => {
    console.log('🚀 Starting ALS Round-Trip Integration Test');
    setupTestDir();

    // Initialize original database
    const originalAdapter = new NativeDuckDBAdapter();
    originalDb = new AutomationDatabase(originalAdapter);
    await originalDb.initialize();

    parser = new ALSParser();
  });

  afterAll(async () => {
    await originalDb.close();
    if (roundTripDb) {
      await roundTripDb.close();
    }
    console.log('✅ ALS Round-Trip Integration Test completed');
  });

  // Individual scenario tests
  for (const scenario of editScenarios) {
    it(`Round-trip test: ${scenario.name}`, async () => {
      const results = await runRoundTripTest(scenario);

      // Basic assertions
      expect(results.editResults.editCount).toBeGreaterThan(0);
      expect(results.editResults.parametersModified).toBeGreaterThan(0);
      expect(results.verificationResults.verified).toBe(true);

      // Log results for debugging
      console.log(`   Edit results: ${results.editResults.description}`);
      console.log(`   Verification: ${results.verificationResults.details}`);

      // Check for unexpected differences
      const { differences } = results;
      const hasUnexpectedDifferences = (
        differences.devices.onlyInOriginal.length > 0 ||
        differences.devices.onlyInRoundTrip.length > 0 ||
        differences.tracks.onlyInOriginal.length > 0 ||
        differences.tracks.onlyInRoundTrip.length > 0 ||
        differences.parameters.onlyInOriginal.length > 0 ||
        differences.parameters.onlyInRoundTrip.length > 0
      );

      if (hasUnexpectedDifferences) {
        console.warn('   Unexpected structural differences found:');
        console.warn('   Devices only in original:', differences.devices.onlyInOriginal.length);
        console.warn('   Devices only in round-trip:', differences.devices.onlyInRoundTrip.length);
        console.warn('   Tracks only in original:', differences.tracks.onlyInOriginal.length);
        console.warn('   Tracks only in round-trip:', differences.tracks.onlyInRoundTrip.length);
        console.warn('   Parameters only in original:', differences.parameters.onlyInOriginal.length);
        console.warn('   Parameters only in round-trip:', differences.parameters.onlyInRoundTrip.length);
      }

      // Automation point differences are expected due to edits
      console.log(`   Automation point differences: ${differences.automationPoints.onlyInOriginal.length} original, ${differences.automationPoints.onlyInRoundTrip.length} round-trip`);
    });
  }

  // Example of how easy it is to add a new scenario:
  it('Custom edit scenario example', async () => {
    // You can define any custom edit logic inline
    const customScenario: EditScenario = {
      name: 'custom_test',
      description: 'Custom automation edits for specific testing',
      applyEdits: async (db) => {
        // Your custom edit logic here
        const devices = await db.devices.getDevicesWithTracks();
        let editCount = 0;

        // Example: Add a specific automation point to all parameters
        for (const device of devices) {
          const tracks = await db.tracks.getTracksForDevice(device.id);
          for (const track of tracks) {
            const parameters = await db.tracks.getParametersForTrack(track.id);
            for (const parameter of parameters) {
              await db.automation.setAutomationPoint(parameter.id, 0.5, 0.8);
              editCount++;
            }
          }
        }

        return {
          editCount,
          parametersModified: editCount,
          description: `Added custom automation point to ${editCount} parameters`
        };
      },
      verifyEdits: async (originalData, newData) => {
        // Your custom verification logic here
        let customPointsFound = 0;
        for (const [parameterId, paramData] of newData) {
          if (parameterId === '_metadata') continue;
          const hasCustomPoint = paramData.automationPoints.some((p: any) =>
            Math.abs(p.timePosition - 0.5) < 0.01 && Math.abs(p.value - 0.8) < 0.01);
          if (hasCustomPoint) customPointsFound++;
        }

        return {
          verified: customPointsFound > 0,
          details: `Found custom points in ${customPointsFound} parameters`
        };
      }
    };

    const results = await runRoundTripTest(customScenario);
    expect(results.verificationResults.verified).toBe(true);
  });

  /**
   * Helper function to capture a snapshot of all parameter automation data
   */
  async function captureParameterSnapshot(database: AutomationDatabase = originalDb): Promise<Map<string, any>> {
    const snapshot = new Map();
    const devices = await database.devices.getDevicesWithTracks();

    let totalPoints = 0;
    let totalParameters = 0;

    for (const device of devices) {
      const tracks = await database.tracks.getTracksForDevice(device.id);

      for (const track of tracks) {
        const parameters = await database.tracks.getParametersForTrack(track.id);
        totalParameters += parameters.length;

        for (const parameter of parameters) {
          const automationPoints = await database.automation.getAutomationPoints({
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
import { ALSParser } from '../../lib/parsers/alsParser';
import { ALSWriter } from '../../lib/parsers/alsWriter';
import { AutomationDatabase } from '../../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../../lib/database/adapters/native';
import { existsSync, readFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { expect } from 'vitest';

export interface RoundTripTestResult {
  structuralComparison: StructuralComparison;
}

export interface StructuralComparison {
  devicesOnlyInOriginal: any[];
  devicesOnlyInRoundTrip: any[];
  tracksOnlyInOriginal: any[];
  tracksOnlyInRoundTrip: any[];
  parametersOnlyInOriginal: any[];
  parametersOnlyInRoundTrip: any[];
  automationPointsOnlyInOriginal: any[];
  automationPointsOnlyInRoundTrip: any[];
}

// Test data directories
const testOutputDir = './test_output';

/**
 * Helper: Create a File object from file path for Node.js compatibility
 */
function createFileFromPath(filePath: string): File {
  const buffer = readFileSync(filePath);
  const fileName = filePath.split('/').pop() || 'unknown.als';

  return createFileFromBuffer(buffer, fileName);
}

/**
 * Helper: Create a File object from buffer for Node.js compatibility
 */
function createFileFromBuffer(buffer: Buffer, fileName: string): File {
  return {
    name: fileName,
    size: buffer.length,
    type: 'application/octet-stream',
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as File;
}

/**
 * Helper: Create a file-based database for comparison
 */
const createFileDatabaseForScenario = async (testName: string, suffix: string) => {
  // Ensure test output directory exists
  if (!existsSync(testOutputDir)) {
    mkdirSync(testOutputDir, { recursive: true });
  }

  const filePath = join(testOutputDir, `${testName}_${suffix}.db`);

  // Delete the file if it already exists to ensure we start fresh
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  const adapter = new NativeDuckDBAdapter(filePath);
  const db = new AutomationDatabase(adapter);
  await db.initialize();
  return { db, filePath };
};

/**
 * Helper: Compare two databases using DuckDB EXCEPT queries
 */
const compareDatabases = async (originalFile: string, roundTripFile: string): Promise<StructuralComparison> => {
  // Create a raw DuckDB instance for comparison
  const comparisonAdapter = new NativeDuckDBAdapter();
  await comparisonAdapter.initialize();

  try {
    // Attach both databases
    console.log(`Attaching original database: ${originalFile}`);
    await comparisonAdapter.execute(`ATTACH '${originalFile}' AS original`);

    console.log(`Attaching round-trip database: ${roundTripFile}`);
    await comparisonAdapter.execute(`ATTACH '${roundTripFile}' AS roundtrip`);

    const differences: StructuralComparison = {
      devicesOnlyInOriginal: [],
      devicesOnlyInRoundTrip: [],
      tracksOnlyInOriginal: [],
      tracksOnlyInRoundTrip: [],
      parametersOnlyInOriginal: [],
      parametersOnlyInRoundTrip: [],
      automationPointsOnlyInOriginal: [],
      automationPointsOnlyInRoundTrip: []
    };

    // Compare devices (excluding generated IDs and timestamps)
    differences.devicesOnlyInOriginal = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, created_at) FROM original.devices
      EXCEPT
      SELECT * EXCLUDE (id, created_at) FROM roundtrip.devices
    `);

    differences.devicesOnlyInRoundTrip = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, created_at) FROM roundtrip.devices
      EXCEPT
      SELECT * EXCLUDE (id, created_at) FROM original.devices
    `);

    // Compare tracks (excluding generated IDs and timestamps)
    differences.tracksOnlyInOriginal = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, device_id, created_at, last_edit_time) FROM original.tracks
      EXCEPT
      SELECT * EXCLUDE (id, device_id, created_at, last_edit_time) FROM roundtrip.tracks
    `);

    differences.tracksOnlyInRoundTrip = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, device_id, created_at, last_edit_time) FROM roundtrip.tracks
      EXCEPT
      SELECT * EXCLUDE (id, device_id, created_at, last_edit_time) FROM original.tracks
    `);

    // Compare parameters (excluding generated IDs and timestamps)
    differences.parametersOnlyInOriginal = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, track_id, created_at) FROM original.parameters
      EXCEPT
      SELECT * EXCLUDE (id, track_id, created_at) FROM roundtrip.parameters
    `);

    differences.parametersOnlyInRoundTrip = await comparisonAdapter.execute(`
      SELECT * EXCLUDE (id, track_id, created_at) FROM roundtrip.parameters
      EXCEPT
      SELECT * EXCLUDE (id, track_id, created_at) FROM original.parameters
    `);

    // Compare automation points (excluding timestamps and IDs)
    differences.automationPointsOnlyInOriginal = await comparisonAdapter.execute(`
      SELECT p.parameter_name, ap.* EXCLUDE (id, parameter_id, created_at, updated_at)
      FROM original.automation_points ap
      JOIN original.parameters p ON ap.parameter_id = p.id
      EXCEPT
      SELECT p.parameter_name, ap.* EXCLUDE (id, parameter_id, created_at, updated_at)
      FROM roundtrip.automation_points ap
      JOIN roundtrip.parameters p ON ap.parameter_id = p.id
    `);

    differences.automationPointsOnlyInRoundTrip = await comparisonAdapter.execute(`
      SELECT p.parameter_name, ap.* EXCLUDE (id, parameter_id, created_at, updated_at)
      FROM roundtrip.automation_points ap
      JOIN roundtrip.parameters p ON ap.parameter_id = p.id
      EXCEPT
      SELECT p.parameter_name, ap.* EXCLUDE (id, parameter_id, created_at, updated_at)
      FROM original.automation_points ap
      JOIN original.parameters p ON ap.parameter_id = p.id
    `);

    return differences;

  } finally {
    await comparisonAdapter.close();
  }
};

/**
 * Runs a complete round-trip test with the given edit function
 */
export async function runRoundTripTest(
  testName: string,
  editFunction: (db: AutomationDatabase) => Promise<void>
): Promise<RoundTripTestResult> {
  console.log(`🧪 Testing scenario: ${testName}`);

  // Step 1: Create file-based databases for testing
  const { db: originalDb, filePath: originalFile } = await createFileDatabaseForScenario(testName, 'original');
  const { db: roundTripDb, filePath: roundTripFile } = await createFileDatabaseForScenario(testName, 'roundtrip');

  const parser = new ALSParser();
  const writer = new ALSWriter(originalDb);

  try {
    // Step 2: Load original ALS file into original database
    const testFile = createFileFromPath('./src/tests/test1.als');
    const originalParsedALS = await parser.parseALSFile(testFile);
    await originalDb.loadALSData(originalParsedALS);

    // Step 3: Apply edits
    await editFunction(originalDb);

    // Step 4: Export to ALS
    const exportedFile = await writer.writeALSFile(originalParsedALS, `test1_${testName}.als`);

    // Step 5: Re-import exported file into round-trip database
    // Convert exported File to buffer and create a new File object for Node.js compatibility

    const exportedBuffer = Buffer.from(await exportedFile.arrayBuffer());
    const reimportedFile = createFileFromBuffer(exportedBuffer, exportedFile.name);

    const reimportedParsedALS = await parser.parseALSFile(reimportedFile);
    await roundTripDb.loadALSData(reimportedParsedALS);

    // Step 6: Compare database structures using DuckDB EXCEPT queries
    const structuralComparison = await compareDatabases(originalFile, roundTripFile);

    // Common assertions that every round-trip test should pass

    // Should preserve exact structure - no spurious entities
    expect(structuralComparison.devicesOnlyInOriginal.length, 'Should not lose any devices').toBe(0);
    expect(structuralComparison.devicesOnlyInRoundTrip.length, 'Should not create spurious devices').toBe(0);
    expect(structuralComparison.tracksOnlyInOriginal.length, 'Should not lose any tracks').toBe(0);
    expect(structuralComparison.tracksOnlyInRoundTrip.length, 'Should not create spurious tracks').toBe(0);
    expect(structuralComparison.parametersOnlyInOriginal.length, 'Should not lose any parameters').toBe(0);
    expect(structuralComparison.parametersOnlyInRoundTrip.length, 'Should not create spurious parameters').toBe(0);

    return {
      structuralComparison
    };

  } finally {
    await originalDb.close();
    await roundTripDb.close();
  }
}


/**
 * Helper to find parameters with automation points for testing
 */
export async function findParametersWithPoints(db: AutomationDatabase): Promise<Array<{parameter: any, points: any[]}>> {
  const devices = await db.devices.getDevicesWithTracks();
  const parametersWithPoints = [];

  for (const device of devices) {
    const tracks = await db.tracks.getTracksForDevice(device.id);
    for (const track of tracks) {
      const parameters = await db.tracks.getParametersForTrack(track.id);
      for (const parameter of parameters) {
        const points = await db.automation.getAutomationPoints({ parameterId: parameter.id });
        if (points.length > 0) {
          parametersWithPoints.push({ parameter, points });
        }
      }
    }
  }

  return parametersWithPoints;
}
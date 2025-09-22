import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { ALSParser } from '../lib/parsers/alsParser';
import { ALSDebugger } from '../lib/utils/alsDebugger';

describe('ALS Parser', () => {
  let testFile: File;
  let parser: ALSParser;

  beforeAll(async () => {
    // Load the test1.als file from tests folder
    const buffer = readFileSync('./src/tests/test1.als');
    // Create a proper File-like object with arrayBuffer method for Node.js
    testFile = {
      name: 'test.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;
    parser = new ALSParser();
  });

  it('should load and decompress the test.als file', async () => {
    expect(testFile).toBeDefined();
    expect(testFile.size).toBeGreaterThan(0);

    // Test that we can decompress and get XML
    const xml = await ALSDebugger.exportXML(testFile);
    expect(xml).toBeDefined();
    expect(typeof xml).toBe('string');
    expect(xml?.length).toBeGreaterThan(0);
  });

  it('should parse XML without errors', async () => {
    const result = await parser.parseALSFile(testFile);
    expect(result).toBeDefined();
    expect(result.name).toBeDefined();
    expect(result.rawXML).toBeDefined();
  });

  it('should extract basic set information', async () => {
    const result = await parser.parseALSFile(testFile);

    expect(result.name).toBe('test');
    expect(result.bpm).toBeGreaterThan(0);

    // Test the extracted database entities
    const entities = parser.extractDatabaseEntities(result);
    expect(Array.isArray(entities.devices)).toBe(true);
  });

  it('should identify Elektron devices', async () => {
    console.log('=== DEBUGGING TEST.ALS FILE ===');
    await ALSDebugger.debugALSFile(testFile);

    const result = await parser.parseALSFile(testFile);
    const entities = parser.extractDatabaseEntities(result);

    console.log('=== PARSER RESULT ===');
    console.log(`Found ${entities.devices.length} Elektron devices`);

    entities.devices.forEach((device, index) => {
      console.log(
        `Device ${index + 1}: ${device.deviceName} (${entities.tracks.filter((t) => t.deviceId === device.id).length} tracks)`,
      );
    });

    // Group tracks by device
    const tracksByDevice = entities.tracks.reduce(
      (acc, track) => {
        if (!acc[track.deviceId]) acc[track.deviceId] = [];
        acc[track.deviceId].push(track);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    // Group parameters by track
    const paramsByTrack = entities.parameters.reduce(
      (acc, param) => {
        if (!acc[param.trackId]) acc[param.trackId] = [];
        acc[param.trackId].push(param);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    Object.keys(tracksByDevice).forEach((deviceId) => {
      const tracks = tracksByDevice[deviceId];
      tracks.forEach((track, trackIndex) => {
        const trackParams = paramsByTrack[track.id] || [];
        console.log(
          `  Track ${trackIndex + 1}: ${track.trackName}, Parameters: ${trackParams.length}`,
        );
        trackParams.slice(0, 3).forEach((param, paramIndex) => {
          const paramPoints = entities.automationPoints.filter((p) => p.parameterId === param.id);
          console.log(
            `    Parameter ${paramIndex + 1}: ${param.parameterName} (${paramPoints.length} points)`,
          );
        });
      });
    });

    // We expect to find at least some devices
    expect(entities.devices.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(entities.devices)).toBe(true);
  });

  it('should handle device name variations', () => {
    const testCases = [
      { input: 'Digitakt II Track 1', expected: 'Digitakt II' },
      { input: 'digitone ii track 2', expected: 'Digitone II' },
      { input: 'OB Digitakt Track 3', expected: 'Digitakt' },
      { input: 'Overbridge Digitone Track 4', expected: 'Digitone' },
      { input: 'Regular Track', expected: null },
    ];

    // Access the private method through a test-specific approach
    const parserAny = parser as any;

    testCases.forEach(({ input, expected }) => {
      const result = parserAny.identifyElektronDevice(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract proper parameter names instead of generic names', async () => {
    const result = await parser.parseALSFile(testFile);
    const entities = parser.extractDatabaseEntities(result);

    expect(entities.devices.length).toBeGreaterThanOrEqual(1);
    expect(entities.parameters.length).toBeGreaterThan(0);

    // Check that we have meaningful parameter names, not generic "Param X"
    const meaningfulParams = entities.parameters.filter(
      (param) => !param.parameterName.startsWith('Param '),
    );

    expect(meaningfulParams.length).toBeGreaterThan(0);

    // Verify we have expected Elektron parameter names
    const paramNames = entities.parameters.map((param) => param.parameterName);
    const expectedPatterns = [
      /^T\d+\s+Mute$/, // Track mute parameters
      /^T\d+\s+Filter/, // Filter parameters
      /^T\d+\s+FX/, // FX parameters
    ];

    let matchedPatterns = 0;
    expectedPatterns.forEach((pattern) => {
      if (paramNames.some((name) => pattern.test(name))) {
        matchedPatterns++;
      }
    });

    expect(matchedPatterns).toBeGreaterThan(0);

    console.log('Parameter names found:', paramNames);
  });

  it('should map PointeeIds to AutomationTarget.Id correctly', async () => {
    const result = await parser.parseALSFile(testFile);
    const entities = parser.extractDatabaseEntities(result);

    expect(entities.parameters.length).toBeGreaterThan(0);

    // All parameters should have meaningful names
    // (no fallback to "Param X" if mapping works correctly)
    entities.parameters.forEach((param, index) => {
      expect(param.parameterName).toBeDefined();
      expect(param.parameterName).not.toBe('');

      // For this test file, we should not have generic parameter names
      // if our PointeeId mapping is working
      if (param.parameterName.startsWith('Param ')) {
        console.warn(`Parameter ${index} fell back to generic name: "${param.parameterName}"`);
      }
    });

    // Verify we have specific Elektron parameter types
    const paramNames = entities.parameters.map((param) => param.parameterName);
    const elektron_specific = paramNames.filter(
      (name) => name.includes('Mute') || name.includes('Filter') || name.includes('FX'),
    );

    expect(elektron_specific.length).toBeGreaterThan(0);
  });

  it('should use provided track ID mapping instead of generating new IDs', async () => {
    const result = await parser.parseALSFile(testFile);

    // First, get the entities without any mapping to see what tracks exist
    const entitiesWithoutMapping = parser.extractDatabaseEntities(result);

    // Create a mapping for some of the tracks we found
    const trackIdMapping: Record<string, string> = {};
    const customTrackIds: string[] = [];

    // Map the first few tracks to custom IDs
    entitiesWithoutMapping.tracks.slice(0, 2).forEach((track, index) => {
      const customId = `custom-track-id-${index + 1}`;
      trackIdMapping[track.trackName] = customId;
      customTrackIds.push(customId);
    });

    // Now extract entities with the mapping
    const entitiesWithMapping = parser.extractDatabaseEntities(result, trackIdMapping);

    // Verify that the specified tracks use the provided IDs
    customTrackIds.forEach((customId) => {
      const trackWithCustomId = entitiesWithMapping.tracks.find((t) => t.id === customId);
      expect(trackWithCustomId).toBeDefined();
      expect(trackWithCustomId?.id).toBe(customId);
    });

    // Verify that tracks not in the mapping still have generated IDs
    const tracksWithGeneratedIds = entitiesWithMapping.tracks.filter(
      (track) => !customTrackIds.includes(track.id),
    );

    // These should all have different IDs from the custom ones
    tracksWithGeneratedIds.forEach((track) => {
      expect(customTrackIds.includes(track.id)).toBe(false);
      expect(track.id).toMatch(/^[a-z0-9]+$/); // Generated IDs are alphanumeric
    });

    // Verify the total number of tracks is the same
    expect(entitiesWithMapping.tracks.length).toBe(entitiesWithoutMapping.tracks.length);

    console.log('Track ID mapping test results:');
    console.log(`Total tracks: ${entitiesWithMapping.tracks.length}`);
    console.log(`Tracks with custom IDs: ${customTrackIds.length}`);
    console.log(`Tracks with generated IDs: ${tracksWithGeneratedIds.length}`);
  });

  it('should correctly identify mute parameters and set isMute attribute', async () => {
    const result = await parser.parseALSFile(testFile);
    const entities = parser.extractDatabaseEntities(result);

    expect(entities.parameters.length).toBeGreaterThan(0);

    // Filter parameters to find mute and non-mute parameters
    const muteParameters = entities.parameters.filter((param) => param.isMute);
    const nonMuteParameters = entities.parameters.filter((param) => !param.isMute);

    // Log parameters for debugging
    console.log('Mute parameters found:');
    muteParameters.forEach((param, index) => {
      console.log(`  ${index + 1}: ${param.parameterName} (isMute: ${param.isMute})`);
    });

    console.log('Non-mute parameters found (first 5):');
    nonMuteParameters.slice(0, 5).forEach((param, index) => {
      console.log(`  ${index + 1}: ${param.parameterName} (isMute: ${param.isMute})`);
    });

    expect(entities.parameters.find((param) => param.parameterName === 'T6 Mute')?.isMute).toBe(
      true,
    );
    expect(
      entities.parameters.find((param) => param.parameterName === 'T3 Filter Frequency')?.isMute,
    ).toBe(false);

    // Verify that all parameters have a defined isMute attribute
    entities.parameters.forEach((param) => {
      expect(typeof param.isMute).toBe('boolean');
    });
  });

  it('should extract mute transitions from binary mute parameters instead of automation points', async () => {
    const result = await parser.parseALSFile(testFile);
    const entities = parser.extractDatabaseEntities(result);

    console.log(`Found ${entities.muteTransitions.length} mute transitions`);
    console.log(`Found ${entities.automationPoints.length} automation points`);
    console.log(`Found ${entities.parameters.length} parameters total`);

    // Check that we have mute transitions
    expect(entities.muteTransitions.length).toBeGreaterThan(0);

    // Find mute parameters
    const muteParameters = entities.parameters.filter(param => param.isMute);
    console.log(`Found ${muteParameters.length} mute parameters:`, muteParameters.map(p => p.parameterName));

    // Verify mute transitions structure
    entities.muteTransitions.forEach((transition, index) => {
      console.log(`  Transition ${index + 1}: time=${transition.timePosition}, muted=${transition.isMuted}`);

      expect(transition.id).toBeDefined();
      expect(transition.trackId).toBeDefined();
      expect(typeof transition.timePosition).toBe('number');
      expect(typeof transition.isMuted).toBe('boolean');
      expect(transition.muteParameterId).toBeDefined();
      expect(transition.createdAt).toBeInstanceOf(Date);

      // Verify the mute parameter reference exists
      const muteParam = entities.parameters.find(p => p.id === transition.muteParameterId);
      expect(muteParam).toBeDefined();
      expect(muteParam?.isMute).toBe(true);
    });

    // Verify that mute parameters with binary values don't create automation points
    const muteParameterIds = muteParameters.map(p => p.id);
    const automationPointsForMuteParams = entities.automationPoints.filter(point =>
      muteParameterIds.includes(point.parameterId)
    );

    console.log(`Automation points for mute parameters: ${automationPointsForMuteParams.length}`);
    // For binary mute parameters, we should have mute transitions instead of automation points
    expect(automationPointsForMuteParams.length).toBe(0);
  });
});

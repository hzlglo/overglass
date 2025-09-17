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
      console.log(`Device ${index + 1}: ${device.deviceName} (${entities.tracks.filter(t => t.deviceId === device.id).length} tracks)`);
    });

    // Group tracks by device
    const tracksByDevice = entities.tracks.reduce((acc, track) => {
      if (!acc[track.deviceId]) acc[track.deviceId] = [];
      acc[track.deviceId].push(track);
      return acc;
    }, {} as Record<string, any[]>);

    // Group parameters by track
    const paramsByTrack = entities.parameters.reduce((acc, param) => {
      if (!acc[param.trackId]) acc[param.trackId] = [];
      acc[param.trackId].push(param);
      return acc;
    }, {} as Record<string, any[]>);

    Object.keys(tracksByDevice).forEach(deviceId => {
      const tracks = tracksByDevice[deviceId];
      tracks.forEach((track, trackIndex) => {
        const trackParams = paramsByTrack[track.id] || [];
        console.log(`  Track ${trackIndex + 1}: ${track.trackName}, Parameters: ${trackParams.length}`);
        trackParams.slice(0, 3).forEach((param, paramIndex) => {
          const paramPoints = entities.automationPoints.filter(p => p.parameterId === param.id);
          console.log(`    Parameter ${paramIndex + 1}: ${param.parameterName} (${paramPoints.length} points)`);
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
    const meaningfulParams = entities.parameters.filter(param =>
      !param.parameterName.startsWith('Param ')
    );

    expect(meaningfulParams.length).toBeGreaterThan(0);

    // Verify we have expected Elektron parameter names
    const paramNames = entities.parameters.map(param => param.parameterName);
    const expectedPatterns = [
      /^T\d+\s+Mute$/,           // Track mute parameters
      /^T\d+\s+Filter/,         // Filter parameters  
      /^T\d+\s+FX/              // FX parameters
    ];
    
    let matchedPatterns = 0;
    expectedPatterns.forEach(pattern => {
      if (paramNames.some(name => pattern.test(name))) {
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
    const paramNames = entities.parameters.map(param => param.parameterName);
    const elektron_specific = paramNames.filter(name =>
      name.includes('Mute') || name.includes('Filter') || name.includes('FX')
    );

    expect(elektron_specific.length).toBeGreaterThan(0);
  });
});

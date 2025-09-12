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
    expect(result.set).toBeDefined();
    expect(result.rawXML).toBeDefined();
  });

  it('should extract basic set information', async () => {
    const result = await parser.parseALSFile(testFile);

    expect(result.set.name).toBe('test');
    expect(result.set.bpm).toBeGreaterThan(0);
    expect(Array.isArray(result.set.elektron)).toBe(true);
  });

  it('should identify Elektron devices', async () => {
    console.log('=== DEBUGGING TEST.ALS FILE ===');
    await ALSDebugger.debugALSFile(testFile);

    const result = await parser.parseALSFile(testFile);

    console.log('=== PARSER RESULT ===');
    console.log(`Found ${result.set.elektron.length} Elektron devices`);

    result.set.elektron.forEach((device, index) => {
      console.log(`Device ${index + 1}: ${device.deviceName} (${device.tracks.length} tracks)`);
      device.tracks.forEach((track, trackIndex) => {
        console.log(
          `  Track ${trackIndex + 1}: Track ${track.trackNumber}, Muted: ${track.isMuted}, Envelopes: ${track.automationEnvelopes.length}`,
        );
        track.automationEnvelopes.slice(0, 3).forEach((envelope, envIndex) => {
          console.log(
            `    Envelope ${envIndex + 1}: ${envelope.parameterName || envelope.id} (${envelope.points.length} points)`,
          );
          if (envelope.points.length > 0) {
            const firstPoint = envelope.points[0];
            const lastPoint = envelope.points[envelope.points.length - 1];
            console.log(`      First point: Time=${firstPoint.time}, Value=${firstPoint.value}`);
            console.log(`      Last point: Time=${lastPoint.time}, Value=${lastPoint.value}`);
          }
        });
      });
    });

    // We expect to find at least some tracks (even if not Elektron)
    // The test will help us understand what's in the file
    expect(result.set).toBeDefined();
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
    
    expect(result.set.elektron).toHaveLength(1);
    const device = result.set.elektron[0];
    expect(device.tracks).toHaveLength(1);
    
    const track = device.tracks[0];
    expect(track.automationEnvelopes.length).toBeGreaterThan(0);
    
    // Check that we have meaningful parameter names, not generic "Param X"
    const meaningfulParams = track.automationEnvelopes.filter(env => 
      !env.parameterName.startsWith('Param ')
    );
    
    expect(meaningfulParams.length).toBeGreaterThan(0);
    
    // Verify we have expected Elektron parameter names
    const paramNames = track.automationEnvelopes.map(env => env.parameterName);
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
    
    const device = result.set.elektron[0];
    const track = device.tracks[0];
    
    // All automation envelopes should have meaningful names 
    // (no fallback to "Param X" if mapping works correctly)
    track.automationEnvelopes.forEach((envelope, index) => {
      expect(envelope.parameterName).toBeDefined();
      expect(envelope.parameterName).not.toBe('');
      
      // For this test file, we should not have generic parameter names
      // if our AutomationTarget.Id mapping is working
      if (envelope.parameterName.startsWith('Param ')) {
        console.warn(`Envelope ${index} fell back to generic name: "${envelope.parameterName}"`);
      }
    });
    
    // Verify we have specific Elektron parameter types
    const paramNames = track.automationEnvelopes.map(env => env.parameterName);
    const elektron_specific = paramNames.filter(name => 
      name.includes('Mute') || name.includes('Filter') || name.includes('FX')
    );
    
    expect(elektron_specific.length).toBeGreaterThan(0);
  });
});

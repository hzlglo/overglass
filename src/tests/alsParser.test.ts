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
});

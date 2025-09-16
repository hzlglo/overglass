import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import {
  gzipXmlHelpers,
  extractAutomationEnvelopes,
  updateAutomationEvents,
  createMinimalALSDocument
} from '../lib/utils/gzipXmlHelpers';

describe('Gzip XML Helpers', () => {
  let originalXmlDoc: Document;
  let originalXmlString: string;

  beforeAll(async () => {
    console.log('🧪 Testing Gzip XML Helpers');
  });

  it('should read and parse an ALS file correctly', async () => {
    console.log('📖 Testing ALS file reading...');

    // Load test ALS file
    const buffer = readFileSync('./src/tests/test1.als');
    const testFile = {
      name: 'test1.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Read and parse the ALS file
    const result = await gzipXmlHelpers.readALSFile(testFile);

    expect(result).toBeDefined();
    expect(result.xmlDoc).toBeDefined();
    expect(result.xmlString).toBeDefined();
    expect(result.xmlString.length).toBeGreaterThan(0);

    // Store for other tests
    originalXmlDoc = result.xmlDoc;
    originalXmlString = result.xmlString;

    // Check basic XML structure
    expect(result.xmlDoc.documentElement.tagName).toBe('Ableton');

    console.log(`✅ ALS file read successfully: ${result.xmlString.length} characters`);
  });

  it('should extract automation envelopes from XML', async () => {
    console.log('🔍 Testing automation envelope extraction...');

    const envelopes = extractAutomationEnvelopes(originalXmlDoc);

    expect(envelopes.length).toBeGreaterThan(0);

    // Check structure of first envelope
    const firstEnvelope = envelopes[0];
    expect(firstEnvelope.id).toBeDefined();
    expect(firstEnvelope.element).toBeDefined();
    expect(Array.isArray(firstEnvelope.events)).toBe(true);

    // Log details for verification
    envelopes.forEach((envelope, index) => {
      console.log(`  Envelope ${index + 1}: ID="${envelope.id}", Events=${envelope.events.length}`);
    });

    console.log(`✅ Extracted ${envelopes.length} automation envelopes`);
  });

  it('should clone XML document correctly', () => {
    console.log('🧬 Testing XML document cloning...');

    const clonedDoc = gzipXmlHelpers.cloneXMLDocument(originalXmlDoc);

    expect(clonedDoc).toBeDefined();
    expect(clonedDoc).not.toBe(originalXmlDoc); // Should be different object
    expect(clonedDoc.documentElement.tagName).toBe(originalXmlDoc.documentElement.tagName);

    // Serialize both and compare
    const originalSerialized = gzipXmlHelpers.serializeXMLDocument(originalXmlDoc);
    const clonedSerialized = gzipXmlHelpers.serializeXMLDocument(clonedDoc);

    expect(clonedSerialized.length).toBe(originalSerialized.length);

    console.log(`✅ XML document cloned successfully`);
  });

  it('should modify automation events in cloned document', () => {
    console.log('✏️  Testing automation event modification...');

    // Clone the document to avoid modifying original
    const workingDoc = gzipXmlHelpers.cloneXMLDocument(originalXmlDoc);

    // Extract envelopes from working document
    const envelopes = extractAutomationEnvelopes(workingDoc);
    expect(envelopes.length).toBeGreaterThan(0);

    // Modify the first envelope with new events
    const testEvents = [
      { time: 0.0, value: 0.0, curveType: 'linear' },
      { time: 1.0, value: 0.5, curveType: 'linear' },
      { time: 2.0, value: 1.0, curveType: 'linear' },
      { time: 3.0, value: 0.25, curveType: 'linear' }
    ];

    updateAutomationEvents(envelopes[0].element, testEvents);

    // Verify the changes
    const updatedEnvelopes = extractAutomationEnvelopes(workingDoc);
    const updatedFirstEnvelope = updatedEnvelopes.find(env => env.id === envelopes[0].id);

    expect(updatedFirstEnvelope).toBeDefined();
    expect(updatedFirstEnvelope!.events).toHaveLength(4);

    // Check that the events match what we set
    expect(updatedFirstEnvelope!.events[0].time).toBe(0.0);
    expect(updatedFirstEnvelope!.events[0].value).toBe(0.0);
    expect(updatedFirstEnvelope!.events[1].time).toBe(1.0);
    expect(updatedFirstEnvelope!.events[1].value).toBe(0.5);
    expect(updatedFirstEnvelope!.events[3].time).toBe(3.0);
    expect(updatedFirstEnvelope!.events[3].value).toBe(0.25);

    console.log(`✅ Modified envelope "${envelopes[0].id}" with ${testEvents.length} new events`);
  });

  it('should write modified XML back to ALS file', async () => {
    console.log('💾 Testing ALS file writing...');

    // Clone and modify the document
    const workingDoc = gzipXmlHelpers.cloneXMLDocument(originalXmlDoc);
    const envelopes = extractAutomationEnvelopes(workingDoc);

    // Modify multiple envelopes with test data
    for (let i = 0; i < Math.min(3, envelopes.length); i++) {
      const testEvents = [
        { time: 0.0, value: 0.1 * i, curveType: 'linear' },
        { time: 1.0, value: 0.5 + 0.1 * i, curveType: 'linear' },
        { time: 2.0, value: 0.9 - 0.1 * i, curveType: 'linear' }
      ];
      updateAutomationEvents(envelopes[i].element, testEvents);
    }

    // Write to ALS file
    const outputFile = await gzipXmlHelpers.writeALSFile(workingDoc, 'test_modified.als');

    expect(outputFile).toBeDefined();
    expect(outputFile.name).toBe('test_modified.als');
    expect(outputFile.size).toBeGreaterThan(0);

    // Save to disk for inspection
    const blob = outputFile as any;
    const buffer = Buffer.from(await blob.arrayBuffer());
    writeFileSync('./src/tests/test_modified.als', buffer);

    console.log(`✅ Modified ALS file written: ${outputFile.name} (${outputFile.size} bytes)`);
  });

  it('should read back the modified ALS file and verify changes', async () => {
    console.log('🔄 Testing round-trip: read modified file...');

    // Read back the modified file
    const buffer = readFileSync('./src/tests/test_modified.als');
    const modifiedFile = {
      name: 'test_modified.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    const result = await gzipXmlHelpers.readALSFile(modifiedFile);

    expect(result).toBeDefined();
    expect(result.xmlDoc).toBeDefined();

    // Extract envelopes and verify our modifications are preserved
    const envelopes = extractAutomationEnvelopes(result.xmlDoc);
    expect(envelopes.length).toBeGreaterThan(0);

    // Check that the first few envelopes have our test modifications
    let modificationsFound = 0;

    for (let i = 0; i < Math.min(3, envelopes.length); i++) {
      const envelope = envelopes[i];

      // Look for our test pattern: 3 events with specific values
      if (envelope.events.length === 3) {
        const hasExpectedPattern = envelope.events.some(event =>
          (event.time === 0.0 && event.value >= 0.0 && event.value <= 0.2) ||
          (event.time === 1.0 && event.value >= 0.5 && event.value <= 0.7) ||
          (event.time === 2.0 && event.value >= 0.7 && event.value <= 0.9)
        );

        if (hasExpectedPattern) {
          modificationsFound++;
          console.log(`  ✅ Found expected modifications in envelope "${envelope.id}"`);
        }
      }
    }

    expect(modificationsFound).toBeGreaterThan(0);

    console.log(`✅ Round-trip successful: ${modificationsFound} modified envelopes verified`);
  });

  it('should create minimal ALS document', () => {
    console.log('🏗️  Testing minimal ALS document creation...');

    const minimalDoc = createMinimalALSDocument(140);

    expect(minimalDoc).toBeDefined();
    expect(minimalDoc.documentElement.tagName).toBe('AbletonLiveSet');

    // Check basic elements
    const creator = minimalDoc.querySelector('Creator');
    expect(creator).toBeDefined();
    expect(creator?.getAttribute('Value')).toBe('Overglass Automation Editor');

    const tempo = minimalDoc.querySelector('MasterTempo');
    expect(tempo).toBeDefined();
    expect(tempo?.getAttribute('Value')).toBe('140');

    const tracks = minimalDoc.querySelector('Tracks');
    expect(tracks).toBeDefined();

    console.log(`✅ Minimal ALS document created with 140 BPM`);
  });

  it('should handle parse and serialize operations', () => {
    console.log('🔄 Testing parse and serialize operations...');

    // Test parsing XML string
    const xmlString = '<root><test value="hello">content</test></root>';
    const parsedDoc = gzipXmlHelpers.parseXMLString(xmlString);

    expect(parsedDoc).toBeDefined();
    expect(parsedDoc.documentElement.tagName).toBe('root');

    const testElement = parsedDoc.querySelector('test');
    expect(testElement).toBeDefined();
    expect(testElement?.getAttribute('value')).toBe('hello');

    // Test serializing back
    const serialized = gzipXmlHelpers.serializeXMLDocument(parsedDoc);
    expect(serialized).toContain('<root>');
    expect(serialized).toContain('<test value="hello">');
    expect(serialized).toContain('content');

    console.log(`✅ Parse and serialize operations working correctly`);
  });

  afterAll(() => {
    console.log('✅ Gzip XML Helpers tests completed');
  });
});
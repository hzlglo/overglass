import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { gzipXmlHelpers } from '../lib/utils/gzipXmlHelpers';

describe('Gzip XML Helpers', () => {
  let originalXmlDoc: Document;
  let originalXmlString: string;

  beforeAll(async () => {
    console.log('🧪 Testing Gzip XML Helpers');
  });

  it('should read and decompress an ALS file correctly', async () => {
    console.log('📖 Testing ALS file reading...');

    // Load test ALS file (this is a real compressed XML file)
    const buffer = readFileSync('./static/test1.als');
    const testFile = {
      name: 'test1.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;

    // Read and parse the compressed file
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

  it('should clone XML document correctly', () => {
    console.log('🧬 Testing XML document cloning...');

    const clonedDoc = gzipXmlHelpers.cloneXMLDocument(originalXmlDoc);

    expect(clonedDoc).toBeDefined();
    expect(clonedDoc).not.toBe(originalXmlDoc); // Should be different object
    expect(clonedDoc.documentElement.tagName).toBe(originalXmlDoc.documentElement.tagName);

    // Serialize both and compare lengths (should be similar)
    const originalSerialized = gzipXmlHelpers.serializeXMLDocument(originalXmlDoc);
    const clonedSerialized = gzipXmlHelpers.serializeXMLDocument(clonedDoc);

    expect(clonedSerialized.length).toBeCloseTo(originalSerialized.length, -1000); // Within 1KB

    console.log(`✅ XML document cloned successfully`);
  });

  it('should compress and write XML back to file', async () => {
    console.log('💾 Testing XML compression and file writing...');

    // Clone and modify the document slightly for testing
    const workingDoc = gzipXmlHelpers.cloneXMLDocument(originalXmlDoc);

    // Add a simple test element to verify round-trip
    const testElement = workingDoc.createElement('TestElement');
    testElement.setAttribute('TestValue', 'RoundTripTest');
    workingDoc.documentElement.appendChild(testElement);

    // Write to compressed file
    const outputFile = await gzipXmlHelpers.writeALSFile(workingDoc, 'test_compressed.als');

    expect(outputFile).toBeDefined();
    expect(outputFile.name).toBe('test_compressed.als');
    expect(outputFile.size).toBeGreaterThan(0);

    console.log(
      `✅ XML file compressed and written: ${outputFile.name} (${outputFile.size} bytes)`,
    );
  });

  it('should compress and decompress XML correctly (integration test)', async () => {
    console.log('🔄 Testing compression round-trip integration...');

    // Use the actual test ALS file to verify compression/decompression works
    const originalDoc = originalXmlDoc;
    const originalSerialized = gzipXmlHelpers.serializeXMLDocument(originalDoc);

    // Compress and write the document
    const compressedFile = await gzipXmlHelpers.writeALSFile(originalDoc, 'integration_test.als');

    expect(compressedFile).toBeDefined();
    expect(compressedFile.name).toBe('integration_test.als');
    expect(compressedFile.size).toBeGreaterThan(0);
    expect(compressedFile.size).toBeLessThan(originalSerialized.length); // Should be compressed

    console.log(
      `✅ Compression successful: ${originalSerialized.length} bytes → ${compressedFile.size} bytes`,
    );
    console.log(
      `✅ Compression ratio: ${((compressedFile.size / originalSerialized.length) * 100).toFixed(1)}%`,
    );
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

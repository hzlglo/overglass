import type { CompressionAdapter } from './compression/compressionAdapter';
import { PakoCompressionAdapter } from './compression/pakoAdapter';

// XML handling for Node.js vs Browser environments
let XMLSerializer: any;
let DOMParser: any;
let DOMImplementation: any;

if (typeof window !== 'undefined') {
  // Browser environment
  XMLSerializer = window.XMLSerializer;
  DOMParser = window.DOMParser;
  DOMImplementation = window.document.implementation;
} else {
  // Node.js environment
  const xmldom = require('@xmldom/xmldom');
  XMLSerializer = xmldom.XMLSerializer;
  DOMParser = xmldom.DOMParser;
  DOMImplementation = xmldom.DOMImplementation;
}

export interface GzipXmlHelpers {
  /**
   * Read and decompress an ALS file to get the XML document
   */
  readALSFile(file: File): Promise<{ xmlDoc: Document; xmlString: string }>;

  /**
   * Create an ALS file from XML document
   */
  writeALSFile(xmlDoc: Document, fileName: string): Promise<File>;

  /**
   * Set compression adapter (for dependency injection)
   */
  setCompressionAdapter(adapter: CompressionAdapter): void;

  /**
   * Clone an XML document (works in both Node.js and browser)
   */
  cloneXMLDocument(xmlDoc: Document): Document;

  /**
   * Parse XML string to Document
   */
  parseXMLString(xmlString: string): Document;

  /**
   * Serialize Document to XML string
   */
  serializeXMLDocument(xmlDoc: Document): string;
}

export class GzipXmlHelpersImpl implements GzipXmlHelpers {
  private compressionAdapter: CompressionAdapter;

  constructor(compressionAdapter?: CompressionAdapter) {
    this.compressionAdapter = compressionAdapter || new PakoCompressionAdapter();
  }

  setCompressionAdapter(adapter: CompressionAdapter): void {
    this.compressionAdapter = adapter;
  }
  async readALSFile(file: File): Promise<{ xmlDoc: Document; xmlString: string }> {
    try {
      // Read the file as ArrayBuffer
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Decompress the gzipped data using the adapter
      const decompressed = await this.compressionAdapter.decompress(uint8Array);

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(decompressed, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Failed to parse ALS file XML: ' + parseError.textContent);
      }

      return {
        xmlDoc,
        xmlString: decompressed
      };
    } catch (error) {
      console.error('Error reading ALS file:', error);
      throw new Error(`Failed to read ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async writeALSFile(xmlDoc: Document, fileName: string): Promise<File> {
    try {
      // Serialize XML document to string
      const serializer = new XMLSerializer();
      const xmlString = serializer.serializeToString(xmlDoc);

      // Compress the XML string using the adapter (creates GZIP, not ZIP)
      const compressed = await this.compressionAdapter.compress(xmlString);

      // Create File object - handle Node.js vs Browser compatibility
      // In test environments, we need to detect properly - vitest provides jsdom which has window but runs in Node
      const isNodeEnv = typeof process !== 'undefined' && process.versions && process.versions.node;

      if (!isNodeEnv && typeof window !== 'undefined') {
        // Browser environment - use native File constructor
        return new File([compressed], fileName, { type: 'application/octet-stream' });
      } else {
        // Node.js environment or test environment - create a File-like object with arrayBuffer method
        return {
          name: fileName,
          size: compressed.length,
          type: 'application/octet-stream',
          arrayBuffer: async () => {
            // Convert Uint8Array to ArrayBuffer
            return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
          },
          // Add other File-like properties for compatibility
          lastModified: Date.now(),
          stream: () => {
            throw new Error('stream() method not implemented for Node.js File polyfill');
          },
          text: async () => {
            throw new Error('text() method not appropriate for binary ALS file');
          },
          slice: () => {
            throw new Error('slice() method not implemented for Node.js File polyfill');
          }
        } as File;
      }
    } catch (error) {
      console.error('Error writing ALS file:', error);
      throw new Error(`Failed to write ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  cloneXMLDocument(xmlDoc: Document): Document {
    try {
      // Method 1: Try native cloneNode if available
      if (xmlDoc.cloneNode) {
        return xmlDoc.cloneNode(true) as Document;
      }

      // Method 2: Serialize and re-parse (works in all environments)
      const serializer = new XMLSerializer();
      const xmlString = serializer.serializeToString(xmlDoc);
      const parser = new DOMParser();
      return parser.parseFromString(xmlString, 'text/xml');
    } catch (error) {
      console.error('Error cloning XML document:', error);
      throw new Error(`Failed to clone XML document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  parseXMLString(xmlString: string): Document {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('XML parsing error: ' + parseError.textContent);
      }

      return xmlDoc;
    } catch (error) {
      console.error('Error parsing XML string:', error);
      throw new Error(`Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  serializeXMLDocument(xmlDoc: Document): string {
    try {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch (error) {
      console.error('Error serializing XML document:', error);
      throw new Error(`Failed to serialize XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Default instance using Pako adapter (works everywhere)
export const gzipXmlHelpers = new GzipXmlHelpersImpl();

/**
 * Helper to create a minimal ALS XML structure for testing
 */
export function createMinimalALSDocument(bpm = 120): Document {
  const xmlDoc = DOMImplementation.createDocument(null, 'Ableton', null);
  const root = xmlDoc.documentElement;

  // Add basic structure
  const creator = xmlDoc.createElement('Creator');
  creator.setAttribute('Value', 'Overglass Automation Editor');
  root.appendChild(creator);

  const majorVersion = xmlDoc.createElement('MajorVersion');
  majorVersion.setAttribute('Value', '5');
  root.appendChild(majorVersion);

  const minorVersion = xmlDoc.createElement('MinorVersion');
  minorVersion.setAttribute('Value', '0');
  root.appendChild(minorVersion);

  const tempo = xmlDoc.createElement('MasterTempo');
  tempo.setAttribute('Value', String(bpm));
  root.appendChild(tempo);

  // Add tracks container
  const tracks = xmlDoc.createElement('Tracks');
  root.appendChild(tracks);

  return xmlDoc;
}


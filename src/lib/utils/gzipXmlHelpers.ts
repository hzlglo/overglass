import type { CompressionAdapter } from './compression/compressionAdapter';
import { PakoCompressionAdapter } from './compression/pakoAdapter';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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

  /**
   * Read and decompress a gzip file from filesystem (Node.js only)
   */
  readGzipFile(filePath: string): Promise<string>;

  /**
   * Format XML string with consistent indentation
   */
  formatXmlString(xmlString: string): string;
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
        xmlString: decompressed,
      };
    } catch (error) {
      console.error('Error reading ALS file:', error);
      throw new Error(
        `Failed to read ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async writeALSFile(xmlDoc: Document, fileName: string): Promise<File> {
    try {
      // Serialize XML document to string using our method that preserves UTF-8 declaration
      const xmlString = this.serializeXMLDocument(xmlDoc);

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
            return compressed.buffer.slice(
              compressed.byteOffset,
              compressed.byteOffset + compressed.byteLength,
            );
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
          },
        } as File;
      }
    } catch (error) {
      console.error('Error writing ALS file:', error);
      throw new Error(
        `Failed to write ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
      throw new Error(
        `Failed to clone XML document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
      throw new Error(
        `Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  serializeXMLDocument(xmlDoc: Document): string {
    try {
      const serializer = new XMLSerializer();
      const serializedXml = serializer.serializeToString(xmlDoc);

      // Ensure the XML declaration includes UTF-8 encoding
      if (serializedXml.startsWith('<?xml version="1.0"?>')) {
        return serializedXml.replace(
          '<?xml version="1.0"?>',
          '<?xml version="1.0" encoding="UTF-8"?>',
        );
      } else if (!serializedXml.startsWith('<?xml')) {
        // Add XML declaration if missing
        return '<?xml version="1.0" encoding="UTF-8"?>' + serializedXml;
      }

      return serializedXml;
    } catch (error) {
      console.error('Error serializing XML document:', error);
      throw new Error(
        `Failed to serialize XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async readGzipFile(filePath: string): Promise<string> {
    try {
      // Import fs dynamically for Node.js environment
      const fs = await import('fs/promises');

      // Read the gzipped file
      const buffer = await fs.readFile(filePath);
      const uint8Array = new Uint8Array(buffer);

      // Decompress using the compression adapter
      return await this.compressionAdapter.decompress(uint8Array);
    } catch (error) {
      console.error('Error reading gzip file:', error);
      throw new Error(
        `Failed to read gzip file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  formatXmlString(xmlString: string): string {
    try {
      // Use fast-xml-parser for consistent formatting

      const parser = new XMLParser({
        ignoreAttributes: false,
        preserveOrder: true,
        ignoreDeclaration: false,
        parseAttributeValue: false,
        trimValues: false,
      });

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        indentBy: '\t',
        preserveOrder: true,
        suppressEmptyNode: true,
        suppressBooleanAttributes: false,
      });

      const parsed = parser.parse(xmlString);
      return builder.build(parsed);
    } catch (error) {
      console.error('Error formatting XML string:', error);
      throw new Error(
        `Failed to format XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

// Default instance using Pako adapter (works everywhere)
export const gzipXmlHelpers = new GzipXmlHelpersImpl();

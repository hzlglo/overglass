import { inflate, deflate } from 'pako';
import JSZip from 'jszip';

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

export const gzipXmlHelpers: GzipXmlHelpers = {
  async readALSFile(file: File): Promise<{ xmlDoc: Document; xmlString: string }> {
    try {
      // Read the file as ArrayBuffer
      const buffer = await file.arrayBuffer();

      // Decompress the gzipped data
      const decompressed = inflate(buffer, { to: 'string' });

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
  },

  async writeALSFile(xmlDoc: Document, fileName: string): Promise<File> {
    try {
      // Serialize XML document to string
      const serializer = new XMLSerializer();
      const xmlString = serializer.serializeToString(xmlDoc);

      // Compress the XML string
      const compressed = deflate(xmlString);

      // Create ALS file (which is a ZIP file with compressed XML)
      const zip = new JSZip();
      zip.file('Ableton Live Set.xml', compressed);

      // Generate the file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipBlob], fileName, { type: 'application/octet-stream' });

      return file;
    } catch (error) {
      console.error('Error writing ALS file:', error);
      throw new Error(`Failed to write ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

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
  },

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
  },

  serializeXMLDocument(xmlDoc: Document): string {
    try {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    } catch (error) {
      console.error('Error serializing XML document:', error);
      throw new Error(`Failed to serialize XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

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

/**
 * Helper to extract automation envelopes from XML document
 */
export function extractAutomationEnvelopes(xmlDoc: Document): Array<{
  id: string;
  element: Element;
  events: Array<{ time: number; value: number; curveType?: string }>;
}> {
  const envelopes: Array<{
    id: string;
    element: Element;
    events: Array<{ time: number; value: number; curveType?: string }>;
  }> = [];

  const automationEnvelopes = xmlDoc.querySelectorAll('AutomationEnvelope');

  for (const envelope of automationEnvelopes) {
    const idElement = envelope.querySelector('Id');
    if (!idElement) continue;

    const automationId = idElement.getAttribute('Value');
    if (!automationId) continue;

    // Extract existing events
    const events: Array<{ time: number; value: number; curveType?: string }> = [];
    const eventElements = envelope.querySelectorAll('Events > FloatEvent');

    for (const eventElement of eventElements) {
      const time = parseFloat(eventElement.getAttribute('Time') || '0');
      const value = parseFloat(eventElement.getAttribute('Value') || '0');
      const curveType = eventElement.getAttribute('CurveType') || 'linear';

      events.push({ time, value, curveType });
    }

    envelopes.push({
      id: automationId,
      element: envelope,
      events
    });
  }

  return envelopes;
}

/**
 * Helper to update automation events in an envelope element
 */
export function updateAutomationEvents(
  envelopeElement: Element,
  newEvents: Array<{ time: number; value: number; curveType?: string }>
): void {
  // Find or create Events element
  let eventsElement = envelopeElement.querySelector('Events');
  if (!eventsElement) {
    eventsElement = envelopeElement.ownerDocument!.createElement('Events');
    envelopeElement.appendChild(eventsElement);
  }

  // Clear existing events
  eventsElement.innerHTML = '';

  // Sort events by time
  const sortedEvents = newEvents.sort((a, b) => a.time - b.time);

  // Add each event as a FloatEvent
  for (const event of sortedEvents) {
    const eventElement = eventsElement.ownerDocument!.createElement('FloatEvent');
    eventElement.setAttribute('Id', String(Math.floor(event.time * 1000))); // Use time * 1000 as ID
    eventElement.setAttribute('Time', String(event.time));
    eventElement.setAttribute('Value', String(event.value));
    eventElement.setAttribute('CurveType', event.curveType || 'linear');

    eventsElement.appendChild(eventElement);
  }

  console.log(`Updated automation envelope with ${newEvents.length} events`);
}
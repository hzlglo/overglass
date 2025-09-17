import type { ParsedALS } from '../types/automation';
import type { AutomationDatabase } from '../database/duckdb';
import type { Device, Track, Parameter, AutomationPoint } from '../database/schema';
import {
  gzipXmlHelpers,
  createMinimalALSDocument
} from '../utils/gzipXmlHelpers';
import {
  extractAutomationEnvelopes,
  updateAutomationEvents,
  getOrCreateAutomationEnvelope
} from './alsXmlHelpers';

export class ALSWriter {
  constructor(private db: AutomationDatabase) {}

  /**
   * Export database contents back to ALS file format
   * This recreates the original ALS structure with updated automation data
   */
  async writeALSFile(originalParsedALS: ParsedALS, fileName: string): Promise<File> {
    try {
      console.log('🔄 Writing ALS file with updated automation data...');

      // Get all current data from database
      const devices = await this.db.devices.getDevicesWithTracks();
      const dbData = await this.collectDatabaseData(devices);

      // Clone the original XML document to preserve structure
      const xmlDoc = gzipXmlHelpers.cloneXMLDocument(originalParsedALS.rawXML);

      // Update automation data in XML
      await this.updateAutomationInXML(xmlDoc, dbData);

      // Create new ALS file with updated XML using helper
      const file = await gzipXmlHelpers.writeALSFile(xmlDoc, fileName);

      console.log(`✅ ALS file written: ${fileName} (${file.size} bytes)`);

      // For Node.js testing environment, also write to disk directly to avoid File object issues
      console.log(`🔧 Checking environment: window is ${typeof window}, process is ${typeof process}`);
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        console.log(`🔧 Node.js environment detected - also writing to disk for testing`);
        try {
          const fs = await import('fs');
          const serializedXml = gzipXmlHelpers.serializeXMLDocument(xmlDoc);
          console.log(`🔧 XML serialized, length: ${serializedXml.length} chars`);

          const { PakoCompressionAdapter } = await import('../utils/compression/pakoAdapter');
          const pakoAdapter = new PakoCompressionAdapter();
          const compressed = await pakoAdapter.compress(serializedXml);
          console.log(`🔧 XML compressed, size: ${compressed.length} bytes`);

          fs.writeFileSync(`./static/${fileName}`, Buffer.from(compressed));
          console.log(`🔧 File successfully saved to ./static/${fileName}`);
        } catch (error) {
          console.error(`🔧 Error in Node.js file writing:`, error);
        }
      } else {
        console.log(`🔧 Browser environment detected, skipping disk write`);
      }

      return file;
    } catch (error) {
      console.error('Error writing ALS file:', error);
      throw new Error(`Failed to write ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect all automation data from database
   */
  private async collectDatabaseData(devices: (Device & { trackCount: number; parameterCount: number; automationPointCount: number })[]) {
    const deviceData = new Map<string, {
      device: Device & { trackCount: number; parameterCount: number; automationPointCount: number };
      tracks: Map<string, {
        track: Track & { parameterCount: number; automationPointCount: number };
        parameters: Map<string, {
          parameter: Parameter;
          automationPoints: AutomationPoint[];
        }>;
      }>;
    }>();

    for (const device of devices) {
      const tracks = await this.db.tracks.getTracksForDevice(device.id);
      const trackData = new Map();

      for (const track of tracks) {
        const parameters = await this.db.tracks.getParametersForTrack(track.id);
        const parameterData = new Map();

        for (const parameter of parameters) {
          const automationPoints = await this.db.automation.getAutomationPoints({
            parameterId: parameter.id
          });

          parameterData.set(parameter.id, {
            parameter,
            automationPoints
          });
        }

        trackData.set(track.id, {
          track,
          parameters: parameterData
        });
      }

      deviceData.set(device.id, {
        device,
        tracks: trackData
      });
    }

    return deviceData;
  }

  /**
   * Update automation envelopes in the XML document with current database values
   */
  private async updateAutomationInXML(xmlDoc: Document, dbData: Map<string, any>) {
    console.log('🔄 Updating XML automation envelopes with database values...');

    // Extract all existing automation envelopes from XML
    const existingEnvelopes = extractAutomationEnvelopes(xmlDoc);
    console.log(`Found ${existingEnvelopes.length} existing automation envelopes in XML`);

    // Build parameter mapping by originalPointeeId for reliable matching
    const parameterPointeeIdMap = new Map<string, any>();
    const parameterIdMap = new Map<string, any>(); // Keep ID map for parameters without originalPointeeId

    for (const [deviceId, deviceInfo] of dbData) {
      for (const [trackId, trackInfo] of deviceInfo.tracks) {
        for (const [parameterId, parameterInfo] of trackInfo.parameters) {
          parameterIdMap.set(parameterInfo.parameter.id, parameterInfo);

          // If parameter has an originalPointeeId, use that for matching
          if (parameterInfo.parameter.originalPointeeId) {
            parameterPointeeIdMap.set(parameterInfo.parameter.originalPointeeId, parameterInfo);
          }
        }
      }
    }

    console.log(`Parameter mapping: ${parameterIdMap.size} total parameters, ${parameterPointeeIdMap.size} with original PointeeId, ${existingEnvelopes.length} envelopes`);

    // Build envelope-to-parameter mapping using PointeeId (same logic as parser)
    const envelopeParameterMap = new Map<Element, any>();
    const processedParameterIds = new Set<string>();

    for (const envelope of existingEnvelopes) {
      // Look for EnvelopeTarget > PointeeId to match with parameter originalPointeeId
      const targetElement = envelope.element.querySelector('EnvelopeTarget');
      if (targetElement) {
        const pointeeIdElement = targetElement.querySelector('PointeeId');
        if (pointeeIdElement) {
          const pointeeId = pointeeIdElement.getAttribute('Value') || pointeeIdElement.textContent || '';

          // Check if this PointeeId matches any of our parameters' originalPointeeId
          if (pointeeId && parameterPointeeIdMap.has(pointeeId)) {
            const parameterInfo = parameterPointeeIdMap.get(pointeeId)!;
            envelopeParameterMap.set(envelope.element, parameterInfo);
            processedParameterIds.add(parameterInfo.parameter.id);
            console.log(`✅ Matched envelope ${envelope.id} to parameter "${parameterInfo.parameter.parameterName}" via PointeeId "${pointeeId}"`);
          } else {
            console.log(`⚠️  Envelope ${envelope.id} has PointeeId "${pointeeId}" but no matching parameter found`);
          }
        } else {
          console.log(`⚠️  Envelope ${envelope.id} has no PointeeId element`);
        }
      } else {
        console.log(`⚠️  Envelope ${envelope.id} has no EnvelopeTarget element`);
      }
    }

    console.log(`Successfully matched ${envelopeParameterMap.size} envelopes to parameters`);

    let updatedCount = 0;
    let createdCount = 0;

    // Update existing matched envelopes
    for (const [envelopeElement, parameterInfo] of envelopeParameterMap) {
      const { automationPoints } = parameterInfo;

      if (automationPoints && automationPoints.length > 0) {
        const events = automationPoints.map((point: any) => ({
          time: point.timePosition,
          value: point.value,
          curveType: point.curveType || 'linear'
        }));

        updateAutomationEvents(envelopeElement, events);
        updatedCount++;
        console.log(`Updated matched envelope with ${events.length} events for parameter "${parameterInfo.parameter.parameterName}"`);
      }
    }

    // Create new envelopes for parameters that weren't matched to existing envelopes
    for (const [parameterId, parameterInfo] of parameterIdMap) {
      if (!processedParameterIds.has(parameterId)) {
        const { parameter, automationPoints } = parameterInfo;

        if (automationPoints && automationPoints.length > 0) {
          console.log(`Creating new envelope for unmatched parameter: "${parameter.parameterName}" (ID: ${parameterId})`);

          const events = automationPoints.map((point: any) => ({
            time: point.timePosition,
            value: point.value,
            curveType: point.curveType || 'linear'
          }));

          const envelopeElement = getOrCreateAutomationEnvelope(xmlDoc, parameter.id, parameter.parameterPath || parameter.parameterName);
          updateAutomationEvents(envelopeElement, events);
          createdCount++;
        }
      }
    }

    console.log(`✅ XML automation update complete: ${updatedCount} updated, ${createdCount} created`);
  }


  /**
   * Create a completely new ALS file from database data (for testing purposes)
   */
  async createNewALSFile(fileName: string, bpm = 120): Promise<File> {
    // Create minimal ALS XML structure
    const xmlDoc = this.createMinimalALSStructure(bpm);

    // Get all data from database
    const devices = await this.db.devices.getDevicesWithTracks();
    const dbData = await this.collectDatabaseData(devices);

    // Add devices and tracks to XML
    await this.addDevicesAndTracksToXML(xmlDoc, dbData);

    // Create ALS file using the gzipXmlHelpers
    const file = await gzipXmlHelpers.writeALSFile(xmlDoc, fileName);

    return file;
  }

  /**
   * Create minimal ALS XML structure
   */
  private createMinimalALSStructure(bpm: number): Document {
    return createMinimalALSDocument(bpm);
  }

  /**
   * Add devices and tracks to XML structure
   */
  private async addDevicesAndTracksToXML(xmlDoc: Document, dbData: Map<string, any>) {
    const tracksElement = xmlDoc.querySelector('Tracks');
    if (!tracksElement) return;

    for (const [deviceId, deviceInfo] of dbData) {
      for (const [trackId, trackInfo] of deviceInfo.tracks) {
        const trackElement = xmlDoc.createElement('MidiTrack');
        trackElement.setAttribute('Id', trackInfo.track.id);

        // Add track name structure
        const nameElement = xmlDoc.createElement('Name');
        const effectiveName = xmlDoc.createElement('EffectiveName');
        effectiveName.setAttribute('Value', trackInfo.track.trackName);
        nameElement.appendChild(effectiveName);
        trackElement.appendChild(nameElement);

        // Add device chain for automation envelopes
        const deviceChain = xmlDoc.createElement('DeviceChain');
        const innerDeviceChain = xmlDoc.createElement('DeviceChain');
        deviceChain.appendChild(innerDeviceChain);
        trackElement.appendChild(deviceChain);

        // Add automation envelopes for this track's parameters
        for (const [parameterId, parameterInfo] of trackInfo.parameters) {
          const { parameter, automationPoints } = parameterInfo;

          if (automationPoints && automationPoints.length > 0) {
            const envelope = getOrCreateAutomationEnvelope(
              xmlDoc,
              parameter.id,
              parameter.parameterPath
            );

            const events = automationPoints.map((point: any) => ({
              time: point.timePosition,
              value: point.value,
              curveType: point.curveType || 'linear'
            }));

            updateAutomationEvents(envelope, events);
            innerDeviceChain.appendChild(envelope);
          }
        }

        tracksElement.appendChild(trackElement);
      }
    }
  }
}
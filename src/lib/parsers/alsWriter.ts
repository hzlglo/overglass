import type { ParsedALS } from '../types/automation';
import type { AutomationDatabase } from '../database/duckdb';
import type { Device, Track, Parameter, AutomationPoint } from '../database/schema';
import {
  gzipXmlHelpers,
  extractAutomationEnvelopes,
  updateAutomationEvents,
  createMinimalALSDocument
} from '../utils/gzipXmlHelpers';

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
    // Extract all automation envelopes from XML
    const envelopes = extractAutomationEnvelopes(xmlDoc);
    console.log(`Found ${envelopes.length} automation envelopes in XML`);

    // Create a mapping of parameter paths to database parameters
    const parameterPathMap = new Map<string, any>();

    for (const [deviceId, deviceInfo] of dbData) {
      for (const [trackId, trackInfo] of deviceInfo.tracks) {
        for (const [parameterId, parameterInfo] of trackInfo.parameters) {
          const parameterPath = parameterInfo.parameter.parameterPath;
          if (parameterPath) {
            parameterPathMap.set(parameterPath, parameterInfo);
          }
        }
      }
    }

    let updatedCount = 0;

    // Update each automation envelope with current database values
    for (const envelope of envelopes) {
      // Find matching parameter in database
      const parameterInfo = parameterPathMap.get(envelope.id);
      if (!parameterInfo) {
        console.log(`No database data found for automation ID: ${envelope.id}`);
        continue;
      }

      // Convert automation points to the format expected by helper
      const events = parameterInfo.automationPoints.map((point: AutomationPoint) => ({
        time: point.timePosition,
        value: point.value,
        curveType: point.curveType || 'linear'
      }));

      // Update the automation points in XML using helper
      updateAutomationEvents(envelope.element, events);
      updatedCount++;
    }

    console.log(`Updated ${updatedCount} automation envelopes with database values`);
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

    // Create ALS file
    const zip = new JSZip();
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xmlDoc);

    zip.file('Ableton Live Set.xml', xmlString);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([zipBlob], fileName, { type: 'application/octet-stream' });

    return file;
  }

  /**
   * Create minimal ALS XML structure
   */
  private createMinimalALSStructure(bpm: number): Document {
    const xmlDoc = DOMImplementation.createDocument(null, 'AbletonLiveSet');
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
   * Add devices and tracks to XML structure
   */
  private async addDevicesAndTracksToXML(xmlDoc: Document, dbData: Map<string, any>) {
    const tracksElement = xmlDoc.querySelector('Tracks');
    if (!tracksElement) return;

    for (const [deviceId, deviceInfo] of dbData) {
      for (const [trackId, trackInfo] of deviceInfo.tracks) {
        const trackElement = xmlDoc.createElement('MidiTrack');
        trackElement.setAttribute('Id', trackInfo.track.id);

        // Add track name
        const nameElement = xmlDoc.createElement('Name');
        nameElement.setAttribute('Value', trackInfo.track.trackName);
        trackElement.appendChild(nameElement);

        // Add automation envelopes for this track
        const deviceChain = xmlDoc.createElement('DeviceChain');
        trackElement.appendChild(deviceChain);

        for (const [parameterId, parameterInfo] of trackInfo.parameters) {
          const envelope = xmlDoc.createElement('AutomationEnvelope');

          const idElement = xmlDoc.createElement('Id');
          idElement.setAttribute('Value', parameterInfo.parameter.parameterPath);
          envelope.appendChild(idElement);

          await this.updateEnvelopeEvents(envelope, parameterInfo.automationPoints);
          deviceChain.appendChild(envelope);
        }

        tracksElement.appendChild(trackElement);
      }
    }
  }
}
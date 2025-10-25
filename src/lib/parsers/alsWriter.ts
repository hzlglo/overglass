import type { ParsedALS } from '../database/schema';
import type { AutomationDatabase } from '../database/duckdb';
import type { Device, Track, Parameter, AutomationPoint, MuteTransition } from '../database/schema';
import { gzipXmlHelpers } from '../utils/gzipXmlHelpers';
import {
  extractAutomationEnvelopes,
  updateAutomationEvents,
  getNextAutomationEnvelopeId,
  createNewParameterAutomationEnvelope,
  findPlaceholderPluginFloatParameter,
  updatePluginFloatParameter,
  getNextVisualIndex,
} from './alsXmlHelpers';
import { getViaPath, getDirectChild, getDirectChildren } from './xmlUtils';

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
      console.log(
        `🔧 Checking environment: window is ${typeof window}, process is ${typeof process}`,
      );
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
      throw new Error(
        `Failed to write ALS file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Collect all automation data from database
   */
  private async collectDatabaseData(
    devices: (Device & {
      trackCount: number;
      parameterCount: number;
      automationPointCount: number;
    })[],
  ) {
    const deviceData = new Map<
      string,
      {
        device: Device & {
          trackCount: number;
          parameterCount: number;
          automationPointCount: number;
        };
        tracks: Map<
          string,
          {
            track: Track & { parameterCount: number; automationPointCount: number };
            parameters: Map<
              string,
              {
                parameter: Parameter;
                automationPoints: AutomationPoint[];
              }
            >;
          }
        >;
      }
    >();

    for (const device of devices) {
      const tracks = await this.db.tracks.getTracksForDevice(device.id);
      const trackData = new Map();

      for (const track of tracks) {
        const parameters = await this.db.tracks.getParametersForTrack(track.id);
        const parameterData = new Map();

        for (const parameter of parameters) {
          const automationPoints = await this.db.automation.getAutomationPoints({
            parameterId: parameter.id,
          });

          parameterData.set(parameter.id, {
            parameter,
            automationPoints,
          });
        }

        // Separately handle mute transitions for this track
        const muteTransitions = await this.db.muteTransitions.getMuteTransitionsForTrack(track.id);
        if (muteTransitions.length > 0) {
          console.log(
            `🔇 Converting ${muteTransitions.length} mute transitions to automation points for track "${track.trackName}"`,
          );

          // Group mute transitions by their mute parameter ID
          const transitionsByParameter = new Map<string, MuteTransition[]>();
          for (const transition of muteTransitions) {
            if (!transitionsByParameter.has(transition.muteParameterId)) {
              transitionsByParameter.set(transition.muteParameterId, []);
            }
            transitionsByParameter.get(transition.muteParameterId)!.push(transition);
          }

          // Convert each group of mute transitions to automation points
          for (const [muteParameterId, transitions] of transitionsByParameter) {
            const muteAutomationPoints: AutomationPoint[] = [];

            // Sort transitions by time to ensure proper ordering
            const sortedTransitions = transitions.sort((a, b) => a.timePosition - b.timePosition);

            // The first transition represents the initial state
            // We need to add automation points that represent the transitions between states
            for (let i = 0; i < sortedTransitions.length; i++) {
              const transition = sortedTransitions[i];

              // For the initial state (usually at -63072000), add a single point
              if (i === 0) {
                const initialPoint = {
                  id: `mute_${transition.id}`,
                  parameterId: muteParameterId,
                  timePosition: transition.timePosition,
                  value: transition.isMuted ? 1 : 0,
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt,
                };
                muteAutomationPoints.push(initialPoint);
              } else {
                // For subsequent transitions, we need to create the state change
                // Add ending point for previous state at current time
                const prevTransition = sortedTransitions[i - 1];
                const endPrevPoint = {
                  id: `mute_${transition.id}_prev`,
                  parameterId: muteParameterId,
                  timePosition: transition.timePosition,
                  value: prevTransition.isMuted ? 1 : 0, // Previous state value
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt,
                };
                muteAutomationPoints.push(endPrevPoint);

                // Add starting point for new state at current time
                const startNewPoint = {
                  id: `mute_${transition.id}`,
                  parameterId: muteParameterId,
                  timePosition: transition.timePosition,
                  value: transition.isMuted ? 1 : 0, // New state value
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt,
                };
                muteAutomationPoints.push(startNewPoint);
              }
            }

            // Sort by time position to maintain proper order
            muteAutomationPoints.sort((a, b) => a.timePosition - b.timePosition);

            // Create or update parameter data for mute parameter
            if (parameterData.has(muteParameterId)) {
              // If parameter already exists (shouldn't happen for mute params), add to existing points
              const existingData = parameterData.get(muteParameterId)!;
              const allPoints = [...existingData.automationPoints, ...muteAutomationPoints];
              allPoints.sort((a, b) => a.timePosition - b.timePosition);
              existingData.automationPoints = allPoints;
            } else {
              // Create a synthetic parameter entry for the mute parameter
              // We need to find the parameter info for this muteParameterId
              const muteParameter = await this.db.run(
                'SELECT id, parameter_name, original_pointee_id FROM parameters WHERE id = ?',
                [muteParameterId],
              );

              if (muteParameter.length > 0) {
                const param = muteParameter[0];
                parameterData.set(muteParameterId, {
                  parameter: {
                    id: param.id,
                    trackId: track.id,
                    parameterName: param.parameterName,
                    originalPointeeId: param.originalPointeeId,
                    isMute: true, // Keep for now until we clean it up
                    createdAt: new Date(),
                  },
                  automationPoints: muteAutomationPoints,
                });
                console.log(
                  `📝 Created synthetic parameter entry for mute parameter "${param.parameterName}" with ${muteAutomationPoints.length} automation points`,
                );
              }
            }
          }
        }

        trackData.set(track.id, {
          track,
          parameters: parameterData,
        });
      }

      deviceData.set(device.id, {
        device,
        tracks: trackData,
      });
    }

    return deviceData;
  }

  /**
   * Update automation envelopes in the XML document with current database values
   * This handles both updating existing parameters and creating new ones
   */
  private async updateAutomationInXML(xmlDoc: Document, dbData: Map<string, any>) {
    console.log('🔄 Updating XML automation envelopes with database values...');

    let updatedCount = 0;
    let createdCount = 0;

    // Find all MidiTracks/AudioTracks that contain devices
    const trackElements = xmlDoc.querySelectorAll('MidiTrack, AudioTrack');

    for (const trackElement of trackElements) {
      // Get the device from this track
      const deviceElement = getViaPath(trackElement, [
        'DeviceChain',
        'DeviceChain',
        'Devices',
        'PluginDevice',
      ]);
      if (!deviceElement) continue;

      const deviceNameElement = getViaPath(deviceElement, ['PluginDesc', 'Vst3PluginInfo', 'Name']);
      if (!deviceNameElement) continue;

      const deviceName = deviceNameElement.getAttribute('Value');
      if (!deviceName) continue;

      // Find this device in our database data
      let deviceData = null;
      for (const [deviceId, deviceInfo] of dbData) {
        if (deviceInfo.device.deviceName === deviceName) {
          deviceData = deviceInfo;
          break;
        }
      }

      if (!deviceData) continue;

      console.log(`📝 Processing device "${deviceName}"`);

      // Get key XML structures for this track
      const deviceChain = getViaPath(trackElement, ['DeviceChain', 'DeviceChain']);
      const envelopesContainer = getViaPath(trackElement, ['AutomationEnvelopes', 'Envelopes']);

      if (!deviceChain || !envelopesContainer) {
        console.log(`❌ Missing required XML structure for device "${deviceName}"`);
        continue;
      }

      // Build a map of existing AutomationEnvelopes by their PointeeId
      const envelopesByPointeeId = new Map<string, Element>();
      const existingEnvelopes = getDirectChildren(envelopesContainer, 'AutomationEnvelope');
      for (const envelope of existingEnvelopes) {
        const targetElement = getDirectChild(envelope, 'EnvelopeTarget');
        const pointeeIdElement = targetElement ? getDirectChild(targetElement, 'PointeeId') : null;
        const pointeeId = pointeeIdElement?.getAttribute('Value');
        if (pointeeId) {
          envelopesByPointeeId.set(pointeeId, envelope);
        }
      }

      // Process each parameter for this device
      for (const [trackId, trackInfo] of deviceData.tracks) {
        for (const [parameterId, parameterInfo] of trackInfo.parameters) {
          const { parameter, automationPoints } = parameterInfo;

          // Skip parameters without automation points
          if (!automationPoints || automationPoints.length === 0) continue;

          const events = automationPoints.map((point: any) => ({
            time: point.timePosition,
            value: point.value,
          }));

          // Check if we have an existing envelope for this parameter (via originalPointeeId)
          const existingEnvelope = parameter.originalPointeeId
            ? envelopesByPointeeId.get(parameter.originalPointeeId)
            : null;

          if (existingEnvelope) {
            // Update existing envelope
            updateAutomationEvents(existingEnvelope, events);
            updatedCount++;
            console.log(
              `✅ Updated envelope for existing parameter "${parameter.parameterName}" with ${events.length} events`,
            );
          } else {
            // This is a NEW parameter - need to create envelope and update PluginFloatParameter
            // Find a placeholder PluginFloatParameter (ParameterId="-1")
            const placeholder = findPlaceholderPluginFloatParameter(deviceChain);
            if (!placeholder) {
              console.log(
                `⚠️  No placeholder PluginFloatParameter available for "${parameter.parameterName}" - skipping`,
              );
              continue;
            }

            // Get the PointeeId from the placeholder's AutomationTarget
            const paramValue = getDirectChild(placeholder.element, 'ParameterValue');
            const automationTarget = paramValue
              ? getDirectChild(paramValue, 'AutomationTarget')
              : null;
            const pointeeId = automationTarget?.getAttribute('Id');

            if (!pointeeId) {
              console.log(
                `⚠️  No AutomationTarget Id found for placeholder - skipping "${parameter.parameterName}"`,
              );
              continue;
            }

            // Create new AutomationEnvelope
            const nextEnvelopeId = getNextAutomationEnvelopeId(trackElement);
            const newEnvelope = createNewParameterAutomationEnvelope(
              xmlDoc,
              nextEnvelopeId,
              pointeeId,
              events,
            );
            envelopesContainer.appendChild(newEnvelope);

            // Update the placeholder PluginFloatParameter
            const nextVisualIndex = getNextVisualIndex(placeholder.parameterList);
            const manualValue = events.length > 0 ? events[0].value : 0.5;

            updatePluginFloatParameter(
              placeholder.element,
              parameter.parameterName,
              parameter.vstParameterId,
              nextVisualIndex,
              manualValue,
            );

            // Update the parameter's originalPointeeId and parameter_path in the database
            // so they match what will be parsed when reading back
            if (!parameter.originalPointeeId || parameter.originalPointeeId === '') {
              // Generate parameter_path that matches what the parser creates
              const parameterPath = `/${deviceName}/${parameter.parameterName}`;

              await this.db.run(
                'UPDATE parameters SET original_pointee_id = ?, parameter_path = ? WHERE id = ?',
                [pointeeId, parameterPath, parameter.id],
              );
            }

            createdCount++;
            console.log(
              `✅ Created new parameter "${parameter.parameterName}" with ${events.length} events (EnvelopeId=${nextEnvelopeId}, VisualIndex=${nextVisualIndex})`,
            );
          }
        }
      }
    }

    console.log(
      `✅ XML automation update complete: ${updatedCount} updated, ${createdCount} created`,
    );
  }
}

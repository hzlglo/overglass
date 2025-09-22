import type { ParsedALS } from '../types/automation';
import type { AutomationDatabase } from '../database/duckdb';
import type { Device, Track, Parameter, AutomationPoint, MuteTransition } from '../database/schema';
import { gzipXmlHelpers } from '../utils/gzipXmlHelpers';
import {
  extractAutomationEnvelopes,
  updateAutomationEvents
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

        // Separately handle mute transitions for this track
        const muteTransitions = await this.db.muteTransitions.getMuteTransitionsForTrack(track.id);
        if (muteTransitions.length > 0) {
          console.log(`🔇 Converting ${muteTransitions.length} mute transitions to automation points for track "${track.trackName}"`);

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
                  curveType: 'linear' as const,
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt
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
                  curveType: 'linear' as const,
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt
                };
                muteAutomationPoints.push(endPrevPoint);

                // Add starting point for new state at current time
                const startNewPoint = {
                  id: `mute_${transition.id}`,
                  parameterId: muteParameterId,
                  timePosition: transition.timePosition,
                  value: transition.isMuted ? 1 : 0, // New state value
                  curveType: 'linear' as const,
                  createdAt: transition.createdAt,
                  updatedAt: transition.updatedAt
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
                [muteParameterId]
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
                    createdAt: new Date()
                  },
                  automationPoints: muteAutomationPoints
                });
                console.log(`📝 Created synthetic parameter entry for mute parameter "${param.parameterName}" with ${muteAutomationPoints.length} automation points`);
              }
            }
          }
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

    // Note: We only update existing envelopes, we don't create new ones
    // The writer should only edit timeseries data, not add new XML structure

    console.log(`✅ XML automation update complete: ${updatedCount} updated`);
  }


}
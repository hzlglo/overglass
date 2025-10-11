import { inflate } from 'pako';
import { sortBy, reverse, uniqBy } from 'lodash';
import type { ParsedALS } from '../database/schema';
import type { Device, Track, Parameter, AutomationPoint, MuteTransition } from '../database/schema';
import { RegexMatcher, createRegexConfig } from '../config/regex';

export class ALSParser {
  private regexMatcher = new RegexMatcher(createRegexConfig('elektron'));
  private debug = false;

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  private elektron_device_names = [
    // Order matters - check longer names first to avoid partial matches
    'Digitakt II',
    'Digitakt',
    'Digitone II',
    'Digitone',
    'Analog Four',
    'Analog Rytm',
    'Octatrack',
  ];

  async parseALSFile(file: File): Promise<ParsedALS> {
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
      throw new Error('Failed to parse ALS file: ' + parseError.textContent);
    }

    // Extract basic set info
    const setName = file.name.replace('.als', '');
    const bpm = this.extractBPM(xmlDoc);

    return {
      name: setName,
      rawXML: xmlDoc,
      // TODO fix BPM and meter parsing
      bpm: bpm || 120,
      meter: {
        numerator: 4,
        denominator: 4,
      },
    };
  }

  /**
   * Extract database entities from parsed ALS data
   */
  extractDatabaseEntities(
    parsedALS: ParsedALS,
    trackIdMapping?: Record<string, string>,
  ): {
    devices: Device[];
    tracks: Track[];
    parameters: Parameter[];
    automationPoints: AutomationPoint[];
    muteTransitions: MuteTransition[];
  } {
    if (!parsedALS.rawXML) {
      throw new Error('No XML document available for parsing');
    }

    const devices: Device[] = [];
    const tracks: Track[] = [];
    const parameters: Parameter[] = [];
    const automationPoints: AutomationPoint[] = [];
    const muteTransitions: MuteTransition[] = [];

    // Extract track automation data directly to database entities
    this.extractDatabaseEntitiesInner(
      parsedALS.rawXML,
      devices,
      tracks,
      parameters,
      automationPoints,
      muteTransitions,
      trackIdMapping,
    );

    return { devices, tracks, parameters, automationPoints, muteTransitions };
  }

  private extractBPM(xmlDoc: Document): number | undefined {
    // Look for BPM in MasterTempo or similar elements
    const tempoElement = xmlDoc.querySelector('MasterTempo Value');
    if (tempoElement) {
      return parseFloat(tempoElement.textContent || '120');
    }
    return 120;
  }

  private extractDatabaseEntitiesInner(
    xmlDoc: Document,
    devices: Device[],
    tracks: Track[],
    parameters: Parameter[],
    automationPoints: AutomationPoint[],
    muteTransitions: MuteTransition[],
    trackIdMapping?: Record<string, string>,
  ): void {
    // Find all tracks
    const trackElements = xmlDoc.querySelectorAll('MidiTrack, AudioTrack');
    console.log(`Found ${trackElements.length} total tracks`);

    trackElements.forEach((trackElement, index) => {
      const trackName = this.getTrackName(trackElement);
      console.log(`Track ${index}: "${trackName}"`);

      const elektron_device = this.identifyElektronDevice(trackName);

      if (elektron_device) {
        console.log(`  -> Identified as ${elektron_device}`);

        // Find or create device
        let device = devices.find((d) => d.deviceName === elektron_device);
        if (!device) {
          device = {
            id: this.generateId(),
            deviceName: elektron_device,
            deviceType: 'elektron',
            createdAt: new Date(),
          };
          devices.push(device);
        }

        // Parse track data directly into database entities
        this.parseElektronTrackToDB(
          trackElement,
          elektron_device,
          device,
          tracks,
          parameters,
          automationPoints,
          muteTransitions,
          trackIdMapping,
        );
      }
    });

    console.log(`Found ${devices.length} Elektron devices`);
  }

  private getTrackName(trackElement: Element): string {
    // Try different possible name locations, checking attributes too
    let name = '';

    // First try EffectiveName Value attribute
    let nameElement = trackElement.querySelector('Name EffectiveName');
    if (nameElement) {
      name = nameElement.getAttribute('Value') || nameElement.textContent || '';
    }

    // Then try UserName Value attribute
    if (!name) {
      nameElement = trackElement.querySelector('Name UserName');
      if (nameElement) {
        name = nameElement.getAttribute('Value') || nameElement.textContent || '';
      }
    }

    // Try direct EffectiveName
    if (!name) {
      nameElement = trackElement.querySelector('EffectiveName');
      if (nameElement) {
        name = nameElement.getAttribute('Value') || nameElement.textContent || '';
      }
    }

    // Try direct UserName
    if (!name) {
      nameElement = trackElement.querySelector('UserName');
      if (nameElement) {
        name = nameElement.getAttribute('Value') || nameElement.textContent || '';
      }
    }

    return name;
  }

  private identifyElektronDevice(trackName: string): string | null {
    const lowerTrackName = trackName.toLowerCase();

    for (const device of this.elektron_device_names) {
      const lowerDevice = device.toLowerCase();
      if (
        lowerTrackName.includes(lowerDevice) ||
        lowerTrackName.includes('ob ' + lowerDevice) ||
        lowerTrackName.includes(lowerDevice.replace(' ', '')) ||
        lowerTrackName.includes('overbridge ' + lowerDevice)
      ) {
        return device;
      }
    }
    return null;
  }

  private parseElektronTrackToDB(
    trackElement: Element,
    deviceName: string,
    device: Device,
    tracks: Track[],
    parameters: Parameter[],
    automationPoints: AutomationPoint[],
    muteTransitions: MuteTransition[],
    trackIdMapping?: Record<string, string>,
  ): void {
    // Check if track is muted (will be applied to all sub-tracks)
    // TODO this is never used, we should remove track.isMuted
    const isMuted = this.isTrackMuted(trackElement);

    // Build parameter mapping from PluginFloatParameter elements
    const parameterMapping = this.buildParameterMapping(trackElement);

    // Extract ALL automation envelopes first
    const allEnvelopes = this.extractAutomationEnvelopes(
      trackElement,
      deviceName,
      0, // We'll override this per envelope
      parameterMapping,
    );

    // Group envelopes by track number found in parameter names
    const envelopesByTrack = new Map<
      number,
      {
        parameterName: string;
        originalPointeeId?: string;
        originalParameterId?: string;
        points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
      }[]
    >();

    allEnvelopes.forEach((envelope) => {
      // Extract track number from parameter name (e.g., "T1 Mute" -> 1, "T3 Filter Frequency" -> 3)
      const trackNumberMatch = envelope.parameterName.match(/^T(\d+)\s+/);
      const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1]) : 0;

      if (!envelopesByTrack.has(trackNumber)) {
        envelopesByTrack.set(trackNumber, []);
      }

      envelopesByTrack.get(trackNumber)!.push({
        parameterName: envelope.parameterName,
        originalPointeeId: envelope.originalPointeeId,
        originalParameterId: envelope.originalParameterId,
        points: envelope.points,
      });
    });

    // Create database entities for each track number found
    envelopesByTrack.forEach((trackParameters, trackNumber) => {
      // Create track entity
      const trackName = `${deviceName} Track ${trackNumber}`;
      const trackId = trackIdMapping?.[trackName] || this.generateId();
      const track: Track = {
        id: trackId,
        deviceId: device.id,
        trackNumber,
        trackName,
        isMuted,
        lastEditTime: this.getLastEditTimeFromParameters(trackParameters),
        createdAt: new Date(),
      };
      tracks.push(track);

      // Create parameter and automation point entities
      if (this.debug)
        console.log(
          `🎯 About to process ${trackParameters.length} trackParameters:`,
          trackParameters.map((p) => ({
            name: p.parameterName,
            hasOriginalPointeeId: !!p.originalPointeeId,
          })),
        );

      // Track whether we've already created mute transitions for this track (only use first mute parameter)
      let hasCreatedMuteTransitions = false;

      trackParameters.forEach(
        ({ parameterName, originalPointeeId, originalParameterId, points }) => {
          const parameterId = this.generateId();

          if (originalPointeeId) {
            console.log(
              `📝 Creating parameter "${parameterName}" with originalPointeeId: "${originalPointeeId}", originalParameterId: "${originalParameterId || 'none'}"`,
            );
          } else {
            console.log(
              `📝 Creating parameter "${parameterName}" with NO originalPointeeId, originalParameterId: "${originalParameterId || 'none'}"`,
            );
          }

          // Check if parameter is a mute parameter using the regex pattern
          const { isMute } = this.regexMatcher.parsemuteParameter(parameterName);

          const parameter: Parameter = {
            id: parameterId,
            trackId,
            parameterName,
            parameterPath: `/${deviceName}/${parameterName}`,
            originalParameterId,
            originalPointeeId,
            isMute,
            createdAt: new Date(),
          };
          if (this.debug)
            console.log(
              `🔍 Parameter object created with originalPointeeId: "${originalPointeeId}", originalParameterId: "${originalParameterId}"`,
            );
          parameters.push(parameter);

          // Check if this is a mute parameter with only 0/1 values - if so, create mute transitions instead of automation points
          // But only use the first mute parameter per track for transitions, others become normal automation
          if (isMute && !hasCreatedMuteTransitions && this.hasOnlyBinaryValues(points)) {
            console.log(
              `🔇 Creating mute transitions for mute parameter "${parameterName}" (first mute param for track ${trackNumber})`,
            );
            // Dedupe by time, keeping the last value for each time position
            const dedupedPoints = reverse(
              uniqBy(reverse(sortBy(points, 'timePosition')), 'timePosition'),
            );

            // Filter to only include actual state changes (alternating pattern)
            const filteredPoints = [];
            let lastState = null;
            for (const point of dedupedPoints) {
              const currentState = point.value === 1; // 1 = muted, 0 = unmuted
              if (lastState === null || currentState !== lastState) {
                filteredPoints.push(point);
                lastState = currentState;
              }
            }

            filteredPoints.forEach((point) => {
              const muteTransition: MuteTransition = {
                id: this.generateId(),
                trackId,
                timePosition: point.timePosition,
                isMuted: point.value === 1, // 1 = muted, 0 = unmuted
                muteParameterId: parameterId,
                createdAt: new Date(),
              };
              muteTransitions.push(muteTransition);
            });
            console.log(
              `🔇 Created ${filteredPoints.length} mute transitions for track ${trackNumber} (filtered from ${dedupedPoints.length} deduped points)`,
            );
            hasCreatedMuteTransitions = true;
          } else {
            // Create automation points for non-mute parameters, mute parameters with non-binary values, or additional mute parameters
            if (isMute && hasCreatedMuteTransitions) {
              console.log(
                `📊 Creating automation points for additional mute parameter "${parameterName}" (already have mute transitions for track ${trackNumber})`,
              );
            }
            points.forEach((point) => {
              const automationPoint: AutomationPoint = {
                id: this.generateId(),
                parameterId,
                timePosition: point.timePosition,
                value: point.value,
                createdAt: new Date(),
              };
              automationPoints.push(automationPoint);
            });
          }
        },
      );
    });
  }

  private getLastEditTimeFromParameters(
    trackParameters: {
      parameterName: string;
      originalPointeeId?: string;
      originalParameterId?: string;
      points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
    }[],
  ): Date {
    // For now, return the latest automation point time converted to a date
    let maxTime = 0;
    trackParameters.forEach((param) => {
      param.points.forEach((point) => {
        maxTime = Math.max(maxTime, point.timePosition);
      });
    });
    // Convert beats to milliseconds for a rough timestamp (assuming 120 BPM)
    const beatsToMs = (beats: number) => (beats / 120) * 60 * 1000;
    return new Date(1970, 0, 1, 0, 0, 0, beatsToMs(maxTime));
  }

  private isTrackMuted(trackElement: Element): boolean {
    // Look for mute state in various possible locations
    const muteElement = trackElement.querySelector('Mute Value');
    return muteElement?.textContent === 'true';
  }

  private buildParameterMapping(
    trackElement: Element,
  ): Record<string, { parameterName: string; originalParameterId?: string }> {
    const parameterMapping: Record<
      string,
      { parameterName: string; originalParameterId?: string }
    > = {};

    // Find PluginFloatParameter elements in the DeviceChain
    const pluginFloatParams = trackElement.querySelectorAll('PluginFloatParameter');

    pluginFloatParams.forEach((param, index) => {
      // Look for ParameterName child
      const parameterNameElement = param.querySelector('ParameterName');
      const paramName = parameterNameElement?.getAttribute('Value') || `Param ${index + 1}`;

      // Look for ParameterId child element
      const parameterIdElement = param.querySelector('ParameterId');
      const parameterId = parameterIdElement?.getAttribute('Value');

      // The key insight: PointeeIds match PluginFloatParameter AutomationTarget._Id (somewhere in the structure)
      const paramId = param.getAttribute('Id');

      // Try different possible paths for AutomationTarget
      let automationTargetElement = param.querySelector('AutomationTarget');
      const automationTargetId = automationTargetElement?.getAttribute('Id');

      if (this.debug && index < 3) {
        console.log(`    🔍 PluginFloatParameter ${index}:`);
        console.log(`      Id="${paramId}"`);
        console.log(`      ParameterId="${parameterId || 'NOT FOUND'}"`);
        console.log(`      AutomationTarget found: ${automationTargetElement ? 'YES' : 'NO'}`);
        if (automationTargetElement) {
          console.log(`      AutomationTarget._Id="${automationTargetId || 'NO _Id ATTR'}"`);
          // Show all attributes on the AutomationTarget element
          if (automationTargetElement.attributes) {
            const attrs = [];
            for (let i = 0; i < automationTargetElement.attributes.length; i++) {
              const attr = automationTargetElement.attributes[i];
              attrs.push(`${attr.name}="${attr.value}"`);
            }
            console.log(`      AutomationTarget attributes: ${attrs.join(', ')}`);
          }
        } else {
          // Show if there are any AutomationTarget elements anywhere in the param
          const allTargets = param.querySelectorAll('AutomationTarget');
          console.log(`      Total AutomationTarget elements found: ${allTargets.length}`);
        }
        console.log(`      ParameterName: "${paramName}"`);
      }

      // Create parameter info object
      const paramInfo = {
        parameterName: paramName,
        originalParameterId: parameterId,
      };
      // TODO why are we using the same map for paramId and automationTargetId? that feels off
      // Map both Id and AutomationTarget._Id to the parameter info
      if (paramId) {
        parameterMapping[paramId] = paramInfo;
      }

      if (automationTargetId) {
        parameterMapping[automationTargetId] = paramInfo;
        if (this.debug && index < 3) {
          console.log(
            `      ✅ Mapped AutomationTarget._Id "${automationTargetId}" → "${paramName}" (parameterId: ${parameterId || 'none'})`,
          );
        }
      }
    });

    if (this.debug) {
      console.log(
        `    📋 Built parameter mapping with ${Object.keys(parameterMapping).length} entries`,
      );

      // Show both the small IDs and large ParameterIds for comparison
      const allKeys = Object.keys(parameterMapping);
      const smallIds = allKeys.filter((k) => parseInt(k) < 1000);
      const largeIds = allKeys.filter((k) => parseInt(k) >= 1000);

      console.log(`    📋 Small IDs (${smallIds.length}):`);
      smallIds.slice(0, 5).forEach((id) => {
        const info = parameterMapping[id];
        console.log(
          `      ID ${id}: "${info.parameterName}" (parameterId: ${info.originalParameterId || 'none'})`,
        );
      });

      if (largeIds.length > 0) {
        console.log(`    📋 Large ParameterIds (${largeIds.length}):`);
        largeIds.slice(0, 5).forEach((id) => {
          const info = parameterMapping[id];
          console.log(
            `      ID ${id}: "${info.parameterName}" (parameterId: ${info.originalParameterId || 'none'})`,
          );
        });
        if (largeIds.length > 5) {
          console.log(`      ... and ${largeIds.length - 5} more`);
        }
      }
    }

    return parameterMapping;
  }

  private extractAutomationEnvelopes(
    trackElement: Element,
    deviceName: string,
    trackNumber: number,
    parameterMapping: Record<string, { parameterName: string; originalParameterId?: string }>,
  ): {
    parameterName: string;
    originalPointeeId?: string;
    originalParameterId?: string;
    points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
  }[] {
    const envelopes: {
      parameterName: string;
      originalPointeeId?: string;
      originalParameterId?: string;
      points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
    }[] = [];

    // Look for automation envelopes in the DeviceChain
    const automationElements = trackElement.querySelectorAll('AutomationEnvelope');

    automationElements.forEach((envElement, index) => {
      const envelope = this.parseAutomationEnvelope(
        envElement,
        deviceName,
        trackNumber,
        index,
        parameterMapping,
      );
      if (envelope) {
        envelopes.push(envelope);
      }
    });

    return envelopes;
  }

  private parseAutomationEnvelope(
    envElement: Element,
    deviceName: string,
    trackNumber: number,
    index: number,
    parameterMapping: Record<string, { parameterName: string; originalParameterId?: string }>,
  ): {
    parameterName: string;
    originalPointeeId?: string;
    originalParameterId?: string;
    points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
  } | null {
    // Extract parameter name and original PointeeId from automation target using the parameter mapping
    const extractedInfo = this.extractParameterInfo(envElement, parameterMapping);
    if (this.debug) console.log(`🎯 extractParameterInfo returned:`, extractedInfo);

    const parameterInfo = extractedInfo || {
      parameterName: `Param ${index + 1}`,
      originalPointeeId: undefined,
      originalParameterId: undefined,
    };

    // Extract automation points
    const points = this.extractAutomationPoints(envElement);

    if (points.length === 0) {
      return null;
    }

    return {
      parameterName: parameterInfo.parameterName,
      originalPointeeId: parameterInfo.originalPointeeId,
      originalParameterId: parameterInfo.originalParameterId,
      points,
    };
  }

  private extractParameterInfo(
    envElement: Element,
    parameterMapping: Record<string, { parameterName: string; originalParameterId?: string }>,
  ): { parameterName: string; originalPointeeId?: string; originalParameterId?: string } | null {
    if (this.debug) console.log(`🔍 Extracting parameter info for envelope`);
    if (this.debug) {
      console.log(`    🔍 Extracting parameter info for envelope:`);
    }

    // Look for EnvelopeTarget to get the parameter reference
    const targetElement = envElement.querySelector('EnvelopeTarget');
    if (!targetElement) {
      if (this.debug) console.log(`❌ No EnvelopeTarget found`);
      if (this.debug) {
        console.log(`    ❌ No EnvelopeTarget found`);
      }
      return null;
    }
    if (this.debug) console.log(`✅ Found EnvelopeTarget`);

    // Check for PointeeId child element first (most direct)
    const pointeeIdElement = targetElement.querySelector('PointeeId');
    if (pointeeIdElement) {
      if (this.debug) console.log(`✅ Found PointeeId element`);
      const pointeeId =
        pointeeIdElement.getAttribute('Value') || pointeeIdElement.textContent || '';
      if (this.debug) console.log(`🔍 PointeeId value: "${pointeeId}"`);
      if (this.debug)
        console.log(`🔍 Parameter mapping has ${Object.keys(parameterMapping).length} entries`);

      if (pointeeId && parameterMapping[pointeeId]) {
        const paramInfo = parameterMapping[pointeeId];
        if (this.debug)
          console.log(
            `✅ Found mapping for PointeeId "${pointeeId}" → "${paramInfo.parameterName}"`,
          );
        if (this.debug) {
          console.log(
            `    ✅ Found parameter via PointeeId child: "${pointeeId}" → "${paramInfo.parameterName}"`,
          );
        }
        if (this.debug) {
          console.log(
            `    ✅ Storing originalPointeeId: "${pointeeId}" for parameter: "${paramInfo.parameterName}" (originalParameterId: ${paramInfo.originalParameterId || 'none'})`,
          );
        }
        return {
          parameterName: paramInfo.parameterName,
          originalPointeeId: pointeeId,
          originalParameterId: paramInfo.originalParameterId,
        };
      } else {
        if (this.debug) console.log(`❌ PointeeId "${pointeeId}" not found in parameter mapping`);
        if (this.debug) {
          console.log(`    ❌ PointeeId "${pointeeId}" not found in parameter mapping`);
        }
      }
    } else {
      if (this.debug) console.log(`❌ No PointeeId element found`);
    }

    // Fall back to other extraction methods but without PointeeId
    const paramInfo = this.extractParameterName(envElement, parameterMapping);
    if (paramInfo) {
      return {
        parameterName: paramInfo.parameterName,
        originalPointeeId: undefined,
        originalParameterId: paramInfo.originalParameterId,
      };
    }

    return null;
  }

  private extractParameterName(
    envElement: Element,
    parameterMapping: Record<string, { parameterName: string; originalParameterId?: string }>,
  ): { parameterName: string; originalParameterId?: string } | null {
    if (this.debug) {
      console.log(`    🔍 Extracting parameter name for envelope:`);
    }

    // Look for EnvelopeTarget to get the parameter reference
    const targetElement = envElement.querySelector('EnvelopeTarget');
    if (!targetElement) {
      if (this.debug) {
        console.log(`    ❌ No EnvelopeTarget found`);
      }
      return null;
    }

    if (this.debug) {
      console.log(`    📍 EnvelopeTarget found with attributes:`);
      if (targetElement.attributes && targetElement.attributes.length > 0) {
        for (let i = 0; i < targetElement.attributes.length; i++) {
          const attr = targetElement.attributes[i];
          console.log(`      ${attr.name}="${attr.value}"`);
        }
      } else {
        console.log(`      No attributes found`);
      }

      // Show child elements
      console.log(`    📍 EnvelopeTarget children:`);
      const children = [];
      for (let i = 0; i < targetElement.childNodes.length; i++) {
        const node = targetElement.childNodes[i];
        if (node.nodeType === 1) {
          // ELEMENT_NODE
          children.push((node as Element).tagName);
        }
      }
      if (children.length > 0) {
        console.log(`      ${children.join(', ')}`);
      } else {
        console.log(`      No child elements found`);
      }
    }

    // Check for PointeeId child element first (most direct)
    const pointeeIdElement = targetElement.querySelector('PointeeId');
    if (pointeeIdElement) {
      const pointeeId =
        pointeeIdElement.getAttribute('Value') || pointeeIdElement.textContent || '';
      if (pointeeId && parameterMapping[pointeeId]) {
        const paramInfo = parameterMapping[pointeeId];
        if (this.debug) {
          console.log(
            `    ✅ Found parameter via PointeeId child: "${pointeeId}" → "${paramInfo.parameterName}"`,
          );
        }
        return paramInfo;
      } else {
        if (this.debug) {
          console.log(`    ❌ PointeeId "${pointeeId}" not found in parameter mapping`);
          console.log(
            `    🗂️  Available parameter IDs: ${Object.keys(parameterMapping).slice(0, 5).join(', ')}...`,
          );
        }
      }
    }

    // Check all attributes on EnvelopeTarget for parameter references
    if (targetElement.attributes) {
      for (let i = 0; i < targetElement.attributes.length; i++) {
        const attr = targetElement.attributes[i];
        if (parameterMapping[attr.value]) {
          const paramInfo = parameterMapping[attr.value];
          if (this.debug) {
            console.log(
              `    ✅ Found parameter via ${attr.name}: "${attr.value}" → "${paramInfo.parameterName}"`,
            );
          }
          return paramInfo;
        }
      }
    }

    // Try to extract parameter ID from Path element
    const pathElement = targetElement.querySelector('Path');
    if (pathElement) {
      const path = pathElement.getAttribute('Value') || pathElement.textContent || '';

      if (this.debug) {
        console.log(`    📁 Found Path element with value: "${path}"`);
      }

      // Extract numeric ID from path (e.g., "Device/Parameter/17" -> "17")
      const numericMatch = path.match(/(\d+)$/);
      if (numericMatch) {
        const paramId = numericMatch[1];
        if (this.debug) {
          console.log(`    🔢 Extracted parameter ID: "${paramId}"`);
          console.log(
            `    🗂️  Parameter mapping has key "${paramId}": ${parameterMapping[paramId] ? 'YES' : 'NO'}`,
          );
        }

        if (parameterMapping[paramId]) {
          const paramInfo = parameterMapping[paramId];
          if (this.debug) {
            console.log(
              `    ✅ Found parameter via Path extraction: "${paramId}" → "${paramInfo.parameterName}"`,
            );
          }
          return paramInfo;
        }
      } else {
        if (this.debug) {
          console.log(`    ❌ No numeric ID found in path: "${path}"`);
        }
      }
    } else {
      if (this.debug) {
        console.log(`    ❌ No Path element found in EnvelopeTarget`);
      }
    }

    if (this.debug) {
      console.log(`    ❌ No parameter name found for envelope`);
    }
    return null;
  }

  private extractAutomationPoints(
    envElement: Element,
  ): Pick<AutomationPoint, 'timePosition' | 'value'>[] {
    const points: Pick<AutomationPoint, 'timePosition' | 'value'>[] = [];

    // Look for FloatEvent elements in the Automation child element
    let eventElements = envElement.querySelectorAll('FloatEvent');

    eventElements.forEach((eventElement) => {
      // Time and Value are attributes directly on the FloatEvent element
      const timeAttr = eventElement.getAttribute('Time');
      const valueAttr = eventElement.getAttribute('Value');

      if (timeAttr !== null && valueAttr !== null) {
        const timePosition = parseFloat(timeAttr);
        const value = parseFloat(valueAttr);

        // Only add if we have valid time/value data
        if (!isNaN(timePosition) && !isNaN(value)) {
          points.push({ timePosition, value });
        }
      }
    });

    return points;
  }

  /**
   * Check if automation points only contain binary values (0 or 1)
   */
  private hasOnlyBinaryValues(points: Pick<AutomationPoint, 'timePosition' | 'value'>[]): boolean {
    return points.every((point) => point.value === 0 || point.value === 1);
  }
}

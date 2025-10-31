import { inflate } from 'pako';
import { sortBy, reverse, uniqBy } from 'lodash';
import type { ParsedALS } from '../database/schema';
import type { Device, Track, Parameter, AutomationPoint, MuteTransition } from '../database/schema';
import { RegexMatcher, createRegexConfig } from '../config/regex';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';

const APP_NAMESPACE = uuidv5('overglass', uuidv5.DNS);

export class ALSParser {
  private regexMatcher = new RegexMatcher(createRegexConfig('elektron'));
  private debug = false;

  static generateId(prefix?: string, name?: string): string {
    if (prefix && name) {
      const key = prefix + ':' + name;
      console.log('Generating UUID for', key);
      return uuidv5(key, APP_NAMESPACE);
    }
    return uuidv4();
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

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
      const deviceElement = this.getFirstDeviceFromTrack(trackElement);
      if (!deviceElement) return;

      // Check if this is an Elektron device by examining the BrowserContentPath
      if (this.isElektronDevice(deviceElement)) {
        const trackName = this.getTrackName(deviceElement);
        console.log(`Track ${index}: "${trackName}"`);

        // Find or create device
        let device = devices.find((d) => d.deviceName === trackName);
        if (!device) {
          device = {
            id: ALSParser.generateId('device', trackName),
            deviceName: trackName,
            deviceType: 'elektron',
            createdAt: new Date(),
          };
          devices.push(device);
        }

        // Parse track data directly into database entities
        this.parseElektronTrackToDB({
          trackElement,
          deviceElement,
          deviceName: trackName,
          device,
          tracks,
          parameters,
          automationPoints,
          muteTransitions,
          trackIdMapping,
        });
      }
    });

    console.log(`Found ${devices.length} Elektron devices`);
  }

  /**
   * Get direct child element by tag name (not descendants)
   */
  private getDirectChild(parent: Element, tagName: string): Element | null {
    for (let i = 0; i < parent.children.length; i++) {
      if (parent.children[i].tagName === tagName) {
        return parent.children[i];
      }
    }
    return null;
  }

  /**
   * Navigate through a path of direct children
   * Example: getViaPath(element, ['PluginDesc', 'Vst3PluginInfo', 'Name'])
   */
  private getViaPath(parent: Element, path: string[]): Element | null {
    let current: Element | null = parent;
    for (const tagName of path) {
      if (!current) return null;
      current = this.getDirectChild(current, tagName);
    }
    return current;
  }

  /**
   * Extract the device name from PluginDesc > Vst3PluginInfo > Name element
   */
  private getTrackName(deviceElement: Element): string {
    const nameElement = this.getViaPath(deviceElement, ['PluginDesc', 'Vst3PluginInfo', 'Name']);
    if (!nameElement) return 'Unknown device';

    const name = nameElement.getAttribute('Value');
    return name || 'Unknown device';
  }

  /**
   * Get the first PluginDevice from a track
   * Path: MidiTrack > DeviceChain > DeviceChain > Devices > PluginDevice
   */
  private getFirstDeviceFromTrack(trackElement: Element): Element | null {
    return this.getViaPath(trackElement, ['DeviceChain', 'DeviceChain', 'Devices', 'PluginDevice']);
  }

  /**
   * Check if a device is an Elektron device by examining the BrowserContentPath
   * Path: PluginDevice > SourceContext > Value > BranchSourceContext > BrowserContentPath
   * Expected format: "query:Plugins#VST3:Elektron%20Music%20Machines:Digitakt%20II"
   */
  private isElektronDevice(deviceElement: Element): boolean {
    const browserContentPath = this.getViaPath(deviceElement, [
      'SourceContext',
      'Value',
      'BranchSourceContext',
      'BrowserContentPath',
    ]);
    if (!browserContentPath) return false;

    const pathValue = browserContentPath.getAttribute('Value');
    if (!pathValue) return false;

    // Check if it contains the Elektron string
    return pathValue.includes('Elektron%20Music%20Machines');
  }

  private parseElektronTrackToDB({
    trackElement,
    deviceElement,
    deviceName,
    device,
    tracks,
    parameters,
    automationPoints,
    muteTransitions,
    trackIdMapping,
  }: {
    trackElement: Element;
    deviceElement: Element;
    deviceName: string;
    device: Device;
    tracks: Track[];
    parameters: Parameter[];
    automationPoints: AutomationPoint[];
    muteTransitions: MuteTransition[];
    trackIdMapping?: Record<string, string>;
  }): void {
    // The structure of an ableton file is: each device has parameters,
    // each parameter has an ID and name and AutomationTarget.Id.
    // If there is automation, AutomationTarget.Id will match up with
    // AutomationEnvelope.EnvelopeTarget.PointeeId

    // Build parameter mapping from PluginFloatParameter elements
    const parameterMapping = this.buildParameterMapping(deviceElement);

    // Extract ALL automation envelopes first
    const allEnvelopes = this.extractAutomationEnvelopes(trackElement, parameterMapping);

    // Group parameters by track number - include ALL parameters from parameterMapping
    const parametersByTrack = new Map<
      number,
      {
        parameterName: string;
        originalPointeeId: string;
        vstParameterId: string;
        points?: Pick<AutomationPoint, 'timePosition' | 'value'>[];
      }[]
    >();

    // First, add all parameters from the parameter mapping (regardless of automation)
    // Filter out parameters with vstParameterId == "-1" as these are not real VST parameters
    Object.entries(parameterMapping).forEach(([automationTargetId, paramInfo]) => {
      // Skip parameters that don't have a valid VST parameter ID
      if (paramInfo.vstParameterId === '-1') {
        return;
      }

      const trackNumber = this.regexMatcher.extractTrackNumber(paramInfo.parameterName) ?? 0;

      if (!parametersByTrack.has(trackNumber)) {
        parametersByTrack.set(trackNumber, []);
      }

      parametersByTrack.get(trackNumber)!.push({
        parameterName: paramInfo.parameterName,
        originalPointeeId: automationTargetId,
        vstParameterId: paramInfo.vstParameterId,
        points: undefined, // Will be filled in if automation exists
      });
    });

    // Then, overlay automation envelope data for parameters that have automation
    allEnvelopes.forEach((envelope) => {
      const trackNumber = this.regexMatcher.extractTrackNumber(envelope.parameterName) ?? 0;
      const trackParams = parametersByTrack.get(trackNumber);

      if (trackParams) {
        // Find the matching parameter by originalPointeeId and add the automation points
        const param = trackParams.find((p) => p.originalPointeeId === envelope.originalPointeeId);
        if (param) {
          param.points = envelope.points;
        }
      }
    });

    // Create database entities for each track number found
    parametersByTrack.forEach((trackParameters, trackNumber) => {
      // Create track entity
      const trackName = `${deviceName} Track ${trackNumber}`;
      const trackId = trackIdMapping?.[trackName] || ALSParser.generateId('track', trackName);
      const track: Track = {
        id: trackId,
        deviceId: device.id,
        trackNumber,
        trackName,
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

      trackParameters.forEach(({ parameterName, originalPointeeId, vstParameterId, points }) => {
        const parameterId = ALSParser.generateId('parameter', parameterName);

        if (originalPointeeId) {
          console.log(
            `📝 Creating parameter "${parameterName}" with originalPointeeId: "${originalPointeeId}", vstParameterId: "${vstParameterId || 'none'}", hasAutomation: ${!!points}`,
          );
        } else {
          console.log(
            `📝 Creating parameter "${parameterName}" with NO originalPointeeId, vstParameterId: "${vstParameterId || 'none'}", hasAutomation: ${!!points}`,
          );
        }

        // Check if parameter is a mute parameter using the regex pattern
        const { isMute } = this.regexMatcher.parseMuteParameter(parameterName);

        const parameter: Parameter = {
          id: parameterId,
          trackId,
          parameterName,
          parameterPath: `/${deviceName}/${parameterName}`,
          vstParameterId,
          originalPointeeId,
          isMute,
          createdAt: new Date(),
        };
        if (this.debug)
          console.log(
            `🔍 Parameter object created with originalPointeeId: "${originalPointeeId}", vstParameterId: "${vstParameterId}"`,
          );
        parameters.push(parameter);

        // Only process automation if points exist
        if (!points || points.length === 0) {
          console.log(`ℹ️  Parameter "${parameterName}" has no automation data`);
          return;
        }

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
              id: ALSParser.generateId(),
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
              id: ALSParser.generateId(),
              parameterId,
              timePosition: point.timePosition,
              value: point.value,
              createdAt: new Date(),
            };
            automationPoints.push(automationPoint);
          });
        }
      });
    });
  }

  private buildParameterMapping(
    deviceElement: Element,
  ): Record<string, { parameterName: string; vstParameterId: string }> {
    const parameterMapping: Record<string, { parameterName: string; vstParameterId: string }> = {};

    // Find PluginFloatParameter elements in the DeviceChain
    const pluginFloatParam = this.getDirectChild(deviceElement, 'ParameterList');
    if (!pluginFloatParam) {
      console.log('❌ No PluginFloatParameter found');
      return parameterMapping;
    }

    Array.from(pluginFloatParam.children).forEach((param, index) => {
      const node = param;
      // Look for ParameterName child
      const parameterNameElement = this.getDirectChild(node, 'ParameterName');
      const paramName = parameterNameElement?.getAttribute('Value') || `Param ${index + 1}`;

      // Look for ParameterId child element
      const parameterIdElement = this.getDirectChild(node, 'ParameterId');
      const parameterId = parameterIdElement?.getAttribute('Value');

      // Look for AutomationTarget child element
      const automationTargetElement = this.getViaPath(node, ['ParameterValue', 'AutomationTarget']);
      const automationTargetId = automationTargetElement?.getAttribute('Id');

      if (automationTargetId && parameterId) {
        parameterMapping[automationTargetId] = {
          parameterName: paramName,
          vstParameterId: parameterId,
        };
        if (this.debug && index < 3) {
          console.log(
            `      ✅ Mapped AutomationTarget._Id "${automationTargetId}" → "${paramName}" (parameterId: ${parameterId || 'none'})`,
          );
        }
      }
    });

    return parameterMapping;
  }

  private extractAutomationEnvelopes(
    trackElement: Element,
    parameterMapping: Record<string, { parameterName: string; vstParameterId: string }>,
  ): {
    parameterName: string;
    originalPointeeId: string;
    vstParameterId: string;
    points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
  }[] {
    const envelopes: {
      parameterName: string;
      originalPointeeId: string;
      vstParameterId: string;
      points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
    }[] = [];

    // Look for automation envelopes in the DeviceChain
    const automationElements = trackElement.querySelectorAll('AutomationEnvelope');

    automationElements.forEach((envElement, index) => {
      const envelope = this.parseAutomationEnvelope(envElement, parameterMapping);
      if (envelope) {
        envelopes.push(envelope);
      }
    });

    return envelopes;
  }

  private parseAutomationEnvelope(
    envElement: Element,
    parameterMapping: Record<string, { parameterName: string; vstParameterId: string }>,
  ): {
    parameterName: string;
    originalPointeeId: string;
    vstParameterId: string;
    points: Pick<AutomationPoint, 'timePosition' | 'value'>[];
  } | null {
    // Extract parameter name and original PointeeId from automation target using the parameter mapping
    const extractedInfo = this.extractParameterInfo(envElement, parameterMapping);
    if (this.debug) console.log(`🎯 extractParameterInfo returned:`, extractedInfo);

    if (!extractedInfo) {
      return null;
    }

    // Extract automation points
    const points = this.extractAutomationPoints(envElement);

    if (points.length === 0) {
      return null;
    }

    return {
      parameterName: extractedInfo.parameterName,
      originalPointeeId: extractedInfo.originalPointeeId,
      vstParameterId: extractedInfo.vstParameterId,
      points,
    };
  }

  private extractParameterInfo(
    envElement: Element,
    parameterMapping: Record<string, { parameterName: string; vstParameterId: string }>,
  ): { parameterName: string; originalPointeeId: string; vstParameterId: string } | null {
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
            `    ✅ Storing originalPointeeId: "${pointeeId}" for parameter: "${paramInfo.parameterName}" (vstParameterId: ${paramInfo.vstParameterId || 'none'})`,
          );
        }
        return {
          parameterName: paramInfo.parameterName,
          originalPointeeId: pointeeId,
          vstParameterId: paramInfo.vstParameterId,
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

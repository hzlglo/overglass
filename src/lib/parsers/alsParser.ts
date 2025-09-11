import { inflate } from 'pako';
import type {
  ParsedALS,
  AbletonSet,
  ElektronDevice,
  ElektronTrack,
  AutomationEnvelope,
  AutomationPoint,
} from '../types/automation';

export class ALSParser {
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

    // Extract Elektron automation data
    const elektron = this.extractElektronData(xmlDoc);

    const abletonSet: AbletonSet = {
      name: setName,
      bpm: bpm || 120,
      elektron,
    };

    return {
      set: abletonSet,
      rawXML: xmlDoc,
    };
  }

  private extractBPM(xmlDoc: Document): number | undefined {
    // Look for BPM in MasterTempo or similar elements
    const tempoElement = xmlDoc.querySelector('MasterTempo Value');
    if (tempoElement) {
      return parseFloat(tempoElement.textContent || '120');
    }
    return 120;
  }

  private extractElektronData(xmlDoc: Document): ElektronDevice[] {
    const devices: ElektronDevice[] = [];

    // Find all tracks
    const tracks = xmlDoc.querySelectorAll('MidiTrack, AudioTrack');
    console.log(`Found ${tracks.length} total tracks`);

    tracks.forEach((trackElement, index) => {
      const trackName = this.getTrackName(trackElement);
      console.log(`Track ${index}: "${trackName}"`);

      const elektron_device = this.identifyElektronDevice(trackName);

      if (elektron_device) {
        console.log(`  -> Identified as ${elektron_device}`);
        let device = devices.find((d) => d.deviceName === elektron_device);
        if (!device) {
          device = { deviceName: elektron_device, tracks: [] };
          devices.push(device);
        }

        const elektron_track = this.parseElektronTrack(trackElement, elektron_device);
        if (elektron_track) {
          device.tracks.push(elektron_track);
        }
      }
    });

    console.log(`Found ${devices.length} Elektron devices`);
    return devices;
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

  private parseElektronTrack(trackElement: Element, deviceName: string): ElektronTrack | null {
    const trackName = this.getTrackName(trackElement);

    // Extract track number from name (e.g., "Digitakt Track 1" -> 1)
    const trackNumberMatch = trackName.match(/Track\s*(\d+)/i) || trackName.match(/T(\d+)/i);
    const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1]) : 0;

    // Check if track is muted
    const isMuted = this.isTrackMuted(trackElement);

    // Extract automation envelopes
    const automationEnvelopes = this.extractAutomationEnvelopes(
      trackElement,
      deviceName,
      trackNumber,
    );

    // Get last edit time (we'll implement this based on automation data)
    const lastEditTime = this.getLastEditTime(automationEnvelopes);

    return {
      trackNumber,
      deviceName,
      isMuted,
      automationEnvelopes,
      lastEditTime,
    };
  }

  private isTrackMuted(trackElement: Element): boolean {
    // Look for mute state in various possible locations
    const muteElement = trackElement.querySelector('Mute Value');
    return muteElement?.textContent === 'true';
  }

  private extractAutomationEnvelopes(
    trackElement: Element,
    deviceName: string,
    trackNumber: number,
  ): AutomationEnvelope[] {
    const envelopes: AutomationEnvelope[] = [];

    // Look for automation envelopes in the DeviceChain
    const automationElements = trackElement.querySelectorAll('AutomationEnvelope');

    automationElements.forEach((envElement, index) => {
      const envelope = this.parseAutomationEnvelope(envElement, deviceName, trackNumber, index);
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
  ): AutomationEnvelope | null {
    // Extract parameter name from automation target
    const parameterName = this.extractParameterName(envElement) || `Param ${index + 1}`;

    // Extract automation points
    const points = this.extractAutomationPoints(envElement);

    if (points.length === 0) {
      return null;
    }

    // Determine min/max values (these may need adjustment based on actual parameter types)
    const values = points.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return {
      id: `${deviceName}_T${trackNumber}_${parameterName}`,
      deviceName,
      parameterName,
      points,
      minValue,
      maxValue,
    };
  }

  private extractParameterName(envElement: Element): string | null {
    // Look for parameter identification in the automation envelope
    // Check EnvelopeTarget structure
    const targetElement = envElement.querySelector('EnvelopeTarget');
    if (targetElement) {
      const pathElement = targetElement.querySelector('Path');
      if (pathElement) {
        // Extract parameter name from the path - try both attribute and text content
        const path = pathElement.getAttribute('Value') || pathElement.textContent || '';
        const parts = path.split('/');
        return parts[parts.length - 1] || null;
      }
    }

    // Fallback to old Target structure
    const oldTargetElement = envElement.querySelector('Target');
    if (oldTargetElement) {
      const pathElement = oldTargetElement.querySelector('Path');
      if (pathElement) {
        const path = pathElement.getAttribute('Value') || pathElement.textContent || '';
        const parts = path.split('/');
        return parts[parts.length - 1] || null;
      }
    }
    return null;
  }

  private extractAutomationPoints(envElement: Element): AutomationPoint[] {
    const points: AutomationPoint[] = [];

    // Look for FloatEvent elements in the Automation child element
    let eventElements = envElement.querySelectorAll('Automation FloatEvent');
    if (eventElements.length === 0) {
      // Fallback to direct FloatEvent search
      eventElements = envElement.querySelectorAll('FloatEvent');
    }

    eventElements.forEach((eventElement) => {
      // Time and Value are attributes directly on the FloatEvent element
      const timeAttr = eventElement.getAttribute('Time');
      const valueAttr = eventElement.getAttribute('Value');

      if (timeAttr !== null && valueAttr !== null) {
        const time = parseFloat(timeAttr);
        const value = parseFloat(valueAttr);

        // Only add if we have valid time/value data
        if (!isNaN(time) && !isNaN(value)) {
          points.push({ time, value });
        }
      }
    });

    // Sort points by time
    points.sort((a, b) => a.time - b.time);

    return points;
  }

  private getLastEditTime(envelopes: AutomationEnvelope[]): number | undefined {
    if (envelopes.length === 0) return undefined;

    // Find the latest automation point across all envelopes
    let latestTime = 0;
    envelopes.forEach((env) => {
      env.points.forEach((point) => {
        if (point.time > latestTime) {
          latestTime = point.time;
        }
      });
    });

    return latestTime > 0 ? latestTime : undefined;
  }
}

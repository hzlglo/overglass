export interface AutomationPoint {
  time: number;
  value: number;
}

export interface AutomationEnvelope {
  id: string;
  deviceName: string;
  parameterName: string;
  points: AutomationPoint[];
  minValue: number;
  maxValue: number;
}

export interface ElektronTrack {
  trackNumber: number;
  deviceName: string; // e.g., "Digitakt", "Digitone"
  isMuted: boolean;
  automationEnvelopes: AutomationEnvelope[];
  lastEditTime?: number;
}

export interface ElektronDevice {
  deviceName: string;
  tracks: ElektronTrack[];
}

export interface AbletonSet {
  name: string;
  bpm: number;
  elektron: ElektronDevice[];
}

export interface ParsedALS {
  set: AbletonSet;
  rawXML?: Document;
}

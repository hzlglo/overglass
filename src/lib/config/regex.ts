// Regex configuration for parsing Elektron parameter names and track information
export interface RegexConfig {
  // Pattern to extract track number from parameter names like "T11 Filter Cutoff" -> 11
  trackNumberPattern: RegExp;
  
  // Pattern to identify mute parameters like "T1 Muted", "T5 Muted"
  muteParameterPattern: RegExp;
  
  // Pattern to clean parameter names (remove track prefix)
  parameterNameCleanPattern?: RegExp;
  
  // Pattern to identify device names in track names
  deviceNamePattern?: RegExp;
}

// Default configuration for Elektron devices
export const DEFAULT_ELEKTRON_REGEX: RegexConfig = {
  // Extract track number from patterns like "T1 Filter Cutoff", "T11 Reverb Send"
  trackNumberPattern: /^T(\d+)\s+/,
  
  // Identify mute parameters like "T1 Muted", "T5 Muted" 
  muteParameterPattern: /^T(\d+)\s+Muted$/i,
  
  // Clean parameter names by removing track prefix "T1 Filter Cutoff" -> "Filter Cutoff"
  parameterNameCleanPattern: /^T\d+\s+/,
  
  // Identify Elektron devices in track names
  deviceNamePattern: /(digitakt|digitone|analog|octatrack|model)/i
};

// Utility functions for applying regex patterns
export class RegexMatcher {
  constructor(private config: RegexConfig) {}

  // Extract track number from parameter name
  extractTrackNumber(parameterName: string): number | null {
    const match = parameterName.match(this.config.trackNumberPattern);
    if (match && match[1]) {
      const trackNum = parseInt(match[1], 10);
      return isNaN(trackNum) ? null : trackNum;
    }
    return null;
  }

  // Check if parameter is a mute parameter and extract track number
  parsemuteParameter(parameterName: string): { isMute: boolean; trackNumber: number | null } {
    const match = parameterName.match(this.config.muteParameterPattern);
    if (match && match[1]) {
      const trackNum = parseInt(match[1], 10);
      return {
        isMute: true,
        trackNumber: isNaN(trackNum) ? null : trackNum
      };
    }
    return { isMute: false, trackNumber: null };
  }

  // Clean parameter name by removing track prefix
  cleanParameterName(parameterName: string): string {
    if (this.config.parameterNameCleanPattern) {
      return parameterName.replace(this.config.parameterNameCleanPattern, '').trim();
    }
    return parameterName;
  }

  // Check if track name contains Elektron device
  matchDeviceName(trackName: string): string | null {
    if (this.config.deviceNamePattern) {
      const match = trackName.match(this.config.deviceNamePattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    return null;
  }

  // Get all track numbers referenced in a list of parameter names
  getAllTrackNumbers(parameterNames: string[]): number[] {
    const trackNumbers = new Set<number>();
    
    parameterNames.forEach(name => {
      const trackNum = this.extractTrackNumber(name);
      if (trackNum !== null) {
        trackNumbers.add(trackNum);
      }
    });

    return Array.from(trackNumbers).sort((a, b) => a - b);
  }

  // Group parameters by track number
  groupParametersByTrack(parameterNames: string[]): Map<number, string[]> {
    const trackGroups = new Map<number, string[]>();
    
    parameterNames.forEach(name => {
      const trackNum = this.extractTrackNumber(name);
      if (trackNum !== null) {
        if (!trackGroups.has(trackNum)) {
          trackGroups.set(trackNum, []);
        }
        trackGroups.get(trackNum)!.push(name);
      }
    });

    return trackGroups;
  }
}

// Create default matcher instance
export const defaultElektronMatcher = new RegexMatcher(DEFAULT_ELEKTRON_REGEX);

// Configuration factory for different device types
export function createRegexConfig(deviceType: 'elektron' | 'custom', customConfig?: Partial<RegexConfig>): RegexConfig {
  switch (deviceType) {
    case 'elektron':
      return { ...DEFAULT_ELEKTRON_REGEX, ...customConfig };
    case 'custom':
      if (!customConfig) {
        throw new Error('Custom regex config must be provided for custom device type');
      }
      return {
        trackNumberPattern: customConfig.trackNumberPattern || /(\d+)/,
        muteParameterPattern: customConfig.muteParameterPattern || /mute/i,
        parameterNameCleanPattern: customConfig.parameterNameCleanPattern,
        deviceNamePattern: customConfig.deviceNamePattern
      };
    default:
      return DEFAULT_ELEKTRON_REGEX;
  }
}
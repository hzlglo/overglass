import { browser } from '$app/environment';
import { has, omit } from 'lodash';
import Papa from 'papaparse';

/**
 * MIDI device and channel mapping settings that are persisted to localStorage
 */
type DeviceMidiMapping = Record<string, Record<string, any>>; // parameterName -> midi mapping data
export type MidiMappingState = {
  deviceMappings: Record<string, DeviceMidiMapping>; // deviceName -> parameterName -> midi mapping data
};

const STORAGE_KEY = 'overglass-midi-mappings';

function getStoredState(): MidiMappingState {
  if (!browser) {
    return { deviceMappings: {} };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load MIDI mapping state from localStorage:', error);
  }

  return { deviceMappings: {} };
}

function saveStateToStorage(state: MidiMappingState): void {
  if (!browser) return;
  console.log('Saving MIDI mappings to localStorage:', state);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save MIDI mapping state to localStorage:', error);
  }
}

const createMidiStore = () => {
  let state = $state<MidiMappingState>(getStoredState());

  return {
    // Getters
    get() {
      return state;
    },

    getDeviceMapping(deviceName: string): DeviceMidiMapping | null {
      return state.deviceMappings[deviceName] || null;
    },

    getMidiChannel(deviceName: string, parameterName: string): number | null {
      const deviceMapping = state.deviceMappings[deviceName];
      if (!deviceMapping) return null;
      try {
        return deviceMapping[parameterName]?.cc_msb;
      } catch (error) {
        console.error('Error getting MIDI channel for parameter:', error);
      }
      return null;
    },

    getAllDeviceNames(): string[] {
      return Object.keys(state.deviceMappings);
    },

    // Setters
    setMidiChannel(deviceName: string, parameterName: string, midiChannel: number): void {
      if (!state.deviceMappings[deviceName]) {
        state.deviceMappings[deviceName] = {};
      }

      state.deviceMappings[deviceName][parameterName] = {
        cc_msb: midiChannel,
      };
      saveStateToStorage(state);
    },
    setMidiMappings(
      deviceName: string,
      parameterName: string,
      midiMappings: Record<string, any>,
    ): void {
      if (!state.deviceMappings[deviceName]) {
        state.deviceMappings[deviceName] = {};
      }

      state.deviceMappings[deviceName][parameterName] = midiMappings;
      saveStateToStorage(state);
    },
    deleteMidiChannel(deviceName: string, parameterName: string): void {
      if (state.deviceMappings[deviceName]) {
        delete state.deviceMappings[deviceName][parameterName];
        saveStateToStorage(state);
      }
    },

    removeDevice(deviceName: string): void {
      if (state.deviceMappings[deviceName]) {
        delete state.deviceMappings[deviceName];
        saveStateToStorage(state);
      }
    },

    // Bulk operations
    setDeviceMapping(deviceName: string, mapping: DeviceMidiMapping): void {
      state.deviceMappings[deviceName] = mapping;
      saveStateToStorage(state);
    },

    clearAllMappings(): void {
      state.deviceMappings = {};
      saveStateToStorage(state);
    },

    // CSV Export/Import
    exportToCSV(deviceName: string): string {
      const deviceMapping = state.deviceMappings[deviceName];
      const cols = new Set<string>('parameter_name');
      for (const [parameterName, midiMappings] of Object.entries(deviceMapping)) {
        cols.add(parameterName);
        for (const key of Object.keys(midiMappings)) {
          cols.add(key);
        }
      }
      const colList = [...cols.values()];
      const rows = [colList];
      for (const [parameterName, midiMappings] of Object.entries(deviceMapping)) {
        const row = [parameterName];
        for (const key of colList.slice(1)) {
          row.push(midiMappings[key] || '');
        }
        rows.push(row);
      }
      return rows.map((row) => row.join(',')).join('\n');
    },

    importFromCSV(csvData: string, deviceName: string): void {
      const data = Papa.parse(csvData, { header: true, skipEmptyLines: true, dynamicTyping: true });
      console.log('data', data);
      const newMappings: DeviceMidiMapping = {};

      for (const row of data.data) {
        console.log('row', row);
        if (!has(row, 'parameter_name')) {
          throw new Error('Invalid CSV data: parameter_name is required');
        }
        if (!has(row, 'cc_msb')) {
          throw new Error('Invalid CSV data: cc_msb is required');
        }
        const parameterName = row.parameter_name;
        newMappings[parameterName] = omit(row, 'parameter_name');
      }

      // Replace current mappings with imported ones
      state.deviceMappings[deviceName] = newMappings;
      saveStateToStorage(state);
    },

    // Debug helpers
    getStorageSize(): number {
      if (!browser) return 0;
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? stored.length : 0;
    },

    getDeviceCount(): number {
      return Object.keys(state.deviceMappings).length;
    },

    getTotalMappingCount(): number {
      return Object.values(state.deviceMappings).reduce(
        (total, device) => total + Object.keys(device.trackMappings).length,
        0,
      );
    },
  };
};

export const midiStore = createMidiStore();

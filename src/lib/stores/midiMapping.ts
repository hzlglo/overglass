/**
 * MIDI device and channel mapping settings that are persisted to localStorage
 */
export type DeviceMidiMapping = Record<string, Record<string, any>>; // parameterName -> midi mapping data
export type MidiMappingState = {
  deviceMappings: Record<string, DeviceMidiMapping>; // deviceName -> parameterName -> midi mapping data
};
export const MUTE_PARAMETER_NAME = 'Track: Mute';

import { mapKeys, snakeCase, camelCase } from 'lodash';

// Database schema with camelCase interfaces (TypeScript friendly)
export interface DatabaseSchema {
  // Core tables for normalized data storage
  devices: Device;
  tracks: Track;
  parameters: Parameter;
  automationPoints: AutomationPoint;
  muteTransitions: MuteTransition;
}

export interface Device {
  id: string; // UUID for the device
  deviceName: string; // e.g., "Digitakt II"
  deviceType: string; // e.g., "elektron"
  createdAt: Date; // timestamp
}

export interface Track {
  id: string; // UUID for the track
  deviceId: string; // Foreign key to devices
  trackNumber: number; // Track number within device (1, 2, 3...)
  trackName: string; // Original track name from ALS
  isMuted: boolean; // Mute state
  lastEditTime?: Date; // Last automation edit timestamp
  createdAt: Date;
}

export interface Parameter {
  id: string; // UUID for the parameter
  trackId: string; // Foreign key to tracks
  parameterName: string; // e.g., "Filter Cutoff", "Volume"
  parameterPath?: string; // Full automation target path from ALS
  originalPointeeId?: string; // Original PointeeId from ALS XML for envelope matching
  isMute: boolean; // Whether this parameter is a mute parameter
  createdAt: Date;
}

export interface AutomationPoint {
  id: string; // UUID for the point
  parameterId: string; // Foreign key to parameters
  timePosition: number; // Time in beats/samples
  value: number; // Automation value (normalized 0-1)
  curveType?: string; // Linear, bezier, etc. (future)
  createdAt: Date;
  updatedAt?: Date;
}

export interface MuteTransition {
  id: string; // UUID for the transition
  trackId: string; // Foreign key to tracks
  timePosition: number; // Time when the transition occurs
  isMuted: boolean; // true = mute track, false = unmute track
  muteParameterId: string; // Reference to the original mute parameter for ALS writing
  createdAt: Date;
  updatedAt?: Date;
}

// Utility functions for camelCase <-> snake_case conversion
export function toSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  return mapKeys(obj, (value, key) => snakeCase(key));
}

export function toCamelCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  return mapKeys(obj, (value, key) => camelCase(key));
}

// SQL table creation statements
export const CREATE_TABLES = {
  devices: `
    CREATE TABLE devices (
      id VARCHAR PRIMARY KEY,
      device_name VARCHAR NOT NULL,
      device_type VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `,

  tracks: `
    CREATE TABLE tracks (
      id VARCHAR PRIMARY KEY,
      device_id VARCHAR NOT NULL,
      track_number INTEGER NOT NULL,
      track_name VARCHAR NOT NULL,
      is_muted BOOLEAN NOT NULL DEFAULT false,
      last_edit_time TIMESTAMP,
      created_at TIMESTAMP NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `,

  parameters: `
    CREATE TABLE parameters (
      id VARCHAR PRIMARY KEY,
      track_id VARCHAR NOT NULL,
      parameter_name VARCHAR NOT NULL,
      parameter_path VARCHAR,
      original_pointee_id VARCHAR,
      is_mute BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(id)
    )
  `,

  automation_points: `
    CREATE TABLE automation_points (
      id VARCHAR PRIMARY KEY,
      parameter_id VARCHAR NOT NULL,
      time_position DOUBLE NOT NULL,
      value DOUBLE NOT NULL,
      curve_type VARCHAR DEFAULT 'linear',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      FOREIGN KEY (parameter_id) REFERENCES parameters(id)
    )
  `,

  mute_transitions: `
    CREATE TABLE mute_transitions (
      id VARCHAR PRIMARY KEY,
      track_id VARCHAR NOT NULL,
      time_position DOUBLE NOT NULL,
      is_muted BOOLEAN NOT NULL,
      mute_parameter_id VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (mute_parameter_id) REFERENCES parameters(id)
    )
  `,

  edit_history: `
    CREATE TABLE edit_history (
      id VARCHAR PRIMARY KEY,
      edit_type VARCHAR NOT NULL,
      edit_timestamp TIMESTAMP NOT NULL,
      affected_tracks TEXT NOT NULL,
      edit_data TEXT NOT NULL,
      can_undo BOOLEAN NOT NULL DEFAULT true
    )
  `,
};

// Indexes for efficient querying
export const CREATE_INDEXES = [
  'CREATE INDEX idx_tracks_device ON tracks(device_id)',
  'CREATE INDEX idx_parameters_track ON parameters(track_id)',
  'CREATE INDEX idx_automation_parameter ON automation_points(parameter_id)',
  'CREATE INDEX idx_automation_time ON automation_points(time_position)',
  'CREATE INDEX idx_automation_param_time ON automation_points(parameter_id, time_position)',
  'CREATE INDEX idx_mute_transitions_track ON mute_transitions(track_id)',
  'CREATE INDEX idx_mute_transitions_time ON mute_transitions(time_position)',
  'CREATE INDEX idx_mute_transitions_mute_parameter ON mute_transitions(mute_parameter_id)',
  'CREATE INDEX idx_edit_history_timestamp ON edit_history(edit_timestamp)',
  'CREATE INDEX idx_edit_history_type ON edit_history(edit_type)',
];

// Computed parameter statistics (no longer stored in DB)
export interface ParameterStats {
  id: string;
  minValue: number;
  maxValue: number;
  minTime: number;
  maxTime: number;
  pointCount: number;
}

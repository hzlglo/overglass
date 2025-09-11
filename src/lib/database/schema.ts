// Database schema for efficient automation data storage and editing
export interface DatabaseSchema {
  // Core tables for normalized data storage
  devices: DeviceTable;
  tracks: TrackTable;
  parameters: ParameterTable;
  automation_points: AutomationPointTable;
  edit_history: EditHistoryTable;
}

export interface DeviceTable {
  device_id: string; // UUID for the device
  device_name: string; // e.g., "Digitakt II"
  device_type: string; // e.g., "elektron"
  created_at: Date; // timestamp
}

export interface TrackTable {
  track_id: string; // UUID for the track
  device_id: string; // Foreign key to devices
  track_number: number; // Track number within device (1, 2, 3...)
  track_name: string; // Original track name from ALS
  is_muted: boolean; // Mute state
  last_edit_time?: Date; // Last automation edit timestamp
  created_at: Date;
}

export interface ParameterTable {
  parameter_id: string; // UUID for the parameter
  track_id: string; // Foreign key to tracks
  parameter_name: string; // e.g., "Filter Cutoff", "Volume"
  parameter_path?: string; // Full automation target path from ALS
  min_value: number; // Parameter range minimum
  max_value: number; // Parameter range maximum
  created_at: Date;
}

export interface AutomationPointTable {
  point_id: string; // UUID for the point
  parameter_id: string; // Foreign key to parameters
  time_position: number; // Time in beats/samples
  value: number; // Automation value (normalized 0-1)
  curve_type?: string; // Linear, bezier, etc. (future)
  created_at: Date;
  updated_at?: Date;
}

export interface EditHistoryTable {
  edit_id: string; // UUID for the edit
  edit_type: 'parameter' | 'clip_move' | 'bulk_move' | 'timeline_edit';
  edit_timestamp: Date; // When the edit was made
  affected_tracks: string; // JSON array of track_ids
  edit_data: string; // JSON blob of edit details
  can_undo: boolean; // Whether this edit can be undone
}

// SQL table creation statements
export const CREATE_TABLES = {
  devices: `
    CREATE TABLE devices (
      device_id VARCHAR PRIMARY KEY,
      device_name VARCHAR NOT NULL,
      device_type VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `,

  tracks: `
    CREATE TABLE tracks (
      track_id VARCHAR PRIMARY KEY,
      device_id VARCHAR NOT NULL,
      track_number INTEGER NOT NULL,
      track_name VARCHAR NOT NULL,
      is_muted BOOLEAN NOT NULL DEFAULT false,
      last_edit_time TIMESTAMP,
      created_at TIMESTAMP NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(device_id)
    )
  `,

  parameters: `
    CREATE TABLE parameters (
      parameter_id VARCHAR PRIMARY KEY,
      track_id VARCHAR NOT NULL,
      parameter_name VARCHAR NOT NULL,
      parameter_path VARCHAR,
      min_value DOUBLE NOT NULL,
      max_value DOUBLE NOT NULL,
      created_at TIMESTAMP NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(track_id)
    )
  `,

  automation_points: `
    CREATE TABLE automation_points (
      point_id VARCHAR PRIMARY KEY,
      parameter_id VARCHAR NOT NULL,
      time_position DOUBLE NOT NULL,
      value DOUBLE NOT NULL,
      curve_type VARCHAR DEFAULT 'linear',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      FOREIGN KEY (parameter_id) REFERENCES parameters(parameter_id)
    )
  `,

  edit_history: `
    CREATE TABLE edit_history (
      edit_id VARCHAR PRIMARY KEY,
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
  'CREATE INDEX idx_edit_history_timestamp ON edit_history(edit_timestamp)',
  'CREATE INDEX idx_edit_history_type ON edit_history(edit_type)',
];

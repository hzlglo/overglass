import type { Track, Parameter, ParameterStats, MidiMapping } from '../schema';
import type { AutomationDatabase } from '../duckdb';
import SQL from 'sql-template-tag';

export class TracksService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Get all tracks across all devices with statistics
   */
  async getAllTracks(): Promise<
    (Track & { parameterCount: number; automationPointCount: number; deviceName: string })[]
  > {
    const sql = SQL`
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.created_at,
        d.device_name,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.created_at, d.device_name
      ORDER BY d.device_name, t.track_number
    `;
    return await this.db.run(sql.sql, sql.values);
  }

  async getAllParameters(): Promise<Parameter[]> {
    const sql = SQL`
      SELECT * FROM parameters
    `;
    return await this.db.run(sql.sql, sql.values);
  }

  /**
   * Get all tracks for a specific device
   */
  async getTracksForDevice(
    deviceId: string,
  ): Promise<(Track & { parameterCount: number; automationPointCount: number })[]> {
    const sql = SQL`
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.created_at,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE t.device_id = ${deviceId}
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.created_at
      ORDER BY t.track_number
    `;
    return await this.db.run(sql.sql, sql.values);
  }

  /**
   * Get parameters with computed statistics for a track
   */
  async getParametersForTrack(trackId: string): Promise<(Parameter & ParameterStats)[]> {
    const sql = SQL`
      SELECT
        p.id,
        p.track_id,
        p.parameter_name,
        p.parameter_path,
        p.vst_parameter_id,
        p.original_pointee_id,
        p.is_mute,
        p.created_at,
        COALESCE(MIN(ap.value), 0) as min_value,
        COALESCE(MAX(ap.value), 1) as max_value,
        COALESCE(MIN(ap.time_position), 0) as min_time,
        COALESCE(MAX(ap.time_position), 0) as max_time,
        COUNT(ap.id) as point_count
      FROM parameters p
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE p.track_id = ${trackId}
      GROUP BY p.id, p.track_id, p.parameter_name, p.parameter_path, p.vst_parameter_id, p.original_pointee_id, p.is_mute, p.created_at
      ORDER BY p.parameter_name
    `;
    const parameters = await this.db.run(sql.sql, sql.values);

    return parameters;
  }

  async getParameterById(parameterId: string): Promise<(Parameter & ParameterStats) | null> {
    const sql = SQL`
      SELECT
        p.id,
        p.track_id,
        p.parameter_name,
        p.parameter_path,
        p.vst_parameter_id,
        p.original_pointee_id,
        p.is_mute,
        p.created_at,
        COALESCE(MIN(ap.value), 0) as min_value,
        COALESCE(MAX(ap.value), 1) as max_value,
        COALESCE(MIN(ap.time_position), 0) as min_time,
        COALESCE(MAX(ap.time_position), 0) as max_time,
        COUNT(ap.id) as point_count
      FROM parameters p
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE p.id = ${parameterId}
      GROUP BY p.id, p.track_id, p.parameter_name, p.parameter_path, p.vst_parameter_id, p.original_pointee_id, p.is_mute, p.created_at
    `;
    const parameters = await this.db.run(sql.sql, sql.values);
    return parameters.length > 0 ? parameters[0] : null;
  }

  /**
   * Get a single track by ID with statistics
   */
  async getTrackById(
    trackId: string,
  ): Promise<
    (Track & { parameterCount: number; automationPointCount: number; deviceName: string }) | null
  > {
    const sql = SQL`
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.created_at,
        d.device_name,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE t.id = ${trackId}
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.created_at, d.device_name
    `;
    const tracks = await this.db.run(sql.sql, sql.values);

    return tracks.length > 0 ? tracks[0] : null;
  }

  /**
   * Create a new parameter
   */
  async createParameter(parameter: Parameter): Promise<Parameter | null> {
    await this.db.insertRecord('parameters', parameter);
    return this.getParameterById(parameter.id);
  }

  /**
   * Create a new track
   */
  async createTrack(track: Track): Promise<Track | null> {
    await this.db.insertRecord('tracks', track);
    return this.getTrackById(track.id);
  }
}

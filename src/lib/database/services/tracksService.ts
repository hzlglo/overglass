import type { Track, Parameter, ParameterStats } from '../schema';
import type { AutomationDatabase } from '../duckdb';

export class TracksService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Get all tracks across all devices with statistics
   */
  async getAllTracks(): Promise<
    (Track & { parameterCount: number; automationPointCount: number; deviceName: string })[]
  > {
    return await this.db.run(`
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.is_muted,
        t.last_edit_time,
        t.created_at,
        d.device_name,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.is_muted, t.last_edit_time, t.created_at, d.device_name
      ORDER BY d.device_name, t.track_number
    `);
  }

  /**
   * Get all tracks for a specific device
   */
  async getTracksForDevice(
    deviceId: string,
  ): Promise<(Track & { parameterCount: number; automationPointCount: number })[]> {
    return await this.db.run(
      `
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.is_muted,
        t.last_edit_time,
        t.created_at,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE t.device_id = ?
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.is_muted, t.last_edit_time, t.created_at
      ORDER BY t.track_number
    `,
      [deviceId],
    );
  }

  /**
   * Get parameters with computed statistics for a track
   */
  async getParametersForTrack(trackId: string): Promise<(Parameter & ParameterStats)[]> {
    const parameters = await this.db.run(
      `
      SELECT
        p.id,
        p.track_id,
        p.parameter_name,
        p.parameter_path,
        p.created_at,
        COALESCE(MIN(ap.value), 0) as min_value,
        COALESCE(MAX(ap.value), 1) as max_value,
        COALESCE(MIN(ap.time_position), 0) as min_time,
        COALESCE(MAX(ap.time_position), 0) as max_time,
        COUNT(ap.id) as point_count
      FROM parameters p
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE p.track_id = ?
      GROUP BY p.id, p.track_id, p.parameter_name, p.parameter_path, p.created_at
      ORDER BY p.parameter_name
    `,
      [trackId],
    );

    return parameters;
  }

  /**
   * Get a single track by ID with statistics
   */
  async getTrackById(
    trackId: string,
  ): Promise<(Track & { parameterCount: number; automationPointCount: number; deviceName: string }) | null> {
    const tracks = await this.db.run(
      `
      SELECT
        t.id,
        t.device_id,
        t.track_number,
        t.track_name,
        t.is_muted,
        t.last_edit_time,
        t.created_at,
        d.device_name,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN devices d ON t.device_id = d.id
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE t.id = ?
      GROUP BY t.id, t.device_id, t.track_number, t.track_name, t.is_muted, t.last_edit_time, t.created_at, d.device_name
    `,
      [trackId],
    );

    return tracks.length > 0 ? tracks[0] : null;
  }
}
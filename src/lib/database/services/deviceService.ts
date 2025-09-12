import type { Device, Track, Parameter, ParameterStats } from '../schema';
import type { ParsedALS } from '../../types/automation';
import { ALSParser } from '../../parsers/alsParser';
import type { AutomationDatabase } from '../duckdb';

export class DeviceService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Load ALS data into devices, tracks, and parameters
   */
  async loadALSData(parsedALS: ParsedALS): Promise<void> {
    const parser = new ALSParser();
    const entities = parser.extractDatabaseEntities(parsedALS);

    // Insert all entities using the database insertRecord method
    for (const device of entities.devices) {
      await this.db.insertRecord('devices', device);
    }

    for (const track of entities.tracks) {
      await this.db.insertRecord('tracks', track);
    }

    for (const parameter of entities.parameters) {
      await this.db.insertRecord('parameters', parameter);
    }

    for (const automationPoint of entities.automationPoints) {
      await this.db.insertRecord('automation_points', automationPoint);
    }
  }

  /**
   * Get all devices with track counts and statistics
   */
  async getDevicesWithTracks(): Promise<any[]> {
    return await this.db.run(`
      SELECT 
        d.id,
        d.device_name,
        d.device_type,
        COUNT(DISTINCT t.id) as track_count,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM devices d
      LEFT JOIN tracks t ON d.id = t.device_id
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      GROUP BY d.id, d.device_name, d.device_type
      ORDER BY d.device_name
    `);
  }

  /**
   * Get all tracks for a specific device
   */
  async getTracksForDevice(deviceId: string): Promise<any[]> {
    return await this.db.run(
      `
      SELECT 
        t.id,
        t.track_number,
        t.track_name,
        t.is_muted,
        t.last_edit_time,
        COUNT(DISTINCT p.id) as parameter_count,
        COUNT(ap.id) as automation_point_count
      FROM tracks t
      LEFT JOIN parameters p ON t.id = p.track_id
      LEFT JOIN automation_points ap ON p.id = ap.parameter_id
      WHERE t.device_id = ?
      GROUP BY t.id, t.track_number, t.track_name, t.is_muted, t.last_edit_time
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
   * Get track automation summary (legacy method)
   */
  async getTrackAutomation(trackId: string): Promise<any[]> {
    return await this.db.run(
      `
      SELECT 
        p.parameter_name,
        p.min_value,
        p.max_value,
        COUNT(ap.point_id) as point_count,
        MIN(ap.time_position) as min_time,
        MAX(ap.time_position) as max_time
      FROM parameters p
      LEFT JOIN automation_points ap ON p.parameter_id = ap.parameter_id
      WHERE p.track_id = ?
      GROUP BY p.parameter_id, p.parameter_name, p.min_value, p.max_value
      ORDER BY p.parameter_name
    `,
      [trackId],
    );
  }

  /**
   * Insert a device record
   */
  private async insertDevice(device: ElektronDevice, timestamp: Date): Promise<string> {
    const deviceId = uuidv4();
    await this.db.run(
      'INSERT INTO devices (id, device_name, device_type, created_at) VALUES (?, ?, ?, ?)',
      [deviceId, device.deviceName, 'elektron', timestamp],
    );
    return deviceId;
  }

  /**
   * Insert a track record
   */
  private async insertTrack(
    deviceId: string,
    track: ElektronTrack,
    timestamp: Date,
  ): Promise<string> {
    const trackId = uuidv4();
    const lastEditTime = track.lastEditTime ? new Date(track.lastEditTime * 1000) : null;
    const trackName = `${track.deviceName} Track ${track.trackNumber}`;

    await this.db.run(
      'INSERT INTO tracks (id, device_id, track_number, track_name, is_muted, last_edit_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trackId, deviceId, track.trackNumber, trackName, track.isMuted, lastEditTime, timestamp],
    );
    return trackId;
  }

  /**
   * Insert a parameter record
   */
  private async insertParameter(
    trackId: string,
    envelope: AutomationEnvelope,
    timestamp: Date,
  ): Promise<string> {
    const parameterId = uuidv4();
    await this.db.run(
      'INSERT INTO parameters (id, track_id, parameter_name, parameter_path, created_at) VALUES (?, ?, ?, ?, ?)',
      [parameterId, trackId, envelope.parameterName, envelope.id, timestamp],
    );
    return parameterId;
  }

  /**
   * Insert automation points for a parameter
   */
  private async insertAutomationPoints(
    parameterId: string,
    envelope: AutomationEnvelope,
    timestamp: Date,
  ): Promise<void> {
    if (envelope.points.length === 0) return;

    // Batch insert for better performance
    const values = envelope.points
      .map(
        (point) =>
          `('${uuidv4()}', '${parameterId}', ${point.time}, ${point.value}, 'linear', '${timestamp.toISOString()}')`,
      )
      .join(',');

    const sql = `
      INSERT INTO automation_points (id, parameter_id, time_position, value, curve_type, created_at)
      VALUES ${values}
    `;

    await this.db.run(sql);
  }
}

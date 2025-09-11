import { CREATE_TABLES, CREATE_INDEXES } from './schema';
import type {
  ParsedALS,
  ElektronDevice,
  ElektronTrack,
  AutomationEnvelope,
} from '../types/automation';
import type { DatabaseAdapter } from './interface';
import { v4 as uuidv4 } from 'uuid';

export class AutomationDatabase {
  private adapter: DatabaseAdapter;
  private isInitialized = false;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize the database adapter
      await this.adapter.initialize();

      // Create tables
      for (const [tableName, sql] of Object.entries(CREATE_TABLES)) {
        await this.run(sql);
        console.log(`✅ Created table: ${tableName}`);
      }

      // Create indexes
      for (const indexSql of CREATE_INDEXES) {
        await this.run(indexSql);
      }
      console.log('✅ Created all indexes');

      this.isInitialized = true;
      console.log('🎉 DuckDB database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  private async run(sql: string, params: any[] = []): Promise<any> {
    return await this.adapter.execute(sql, params);
  }

  async loadALSData(parsedALS: ParsedALS): Promise<void> {
    console.log('📊 Loading ALS data into database...');
    const now = new Date();

    try {
      await this.run('BEGIN TRANSACTION');

      // Clear existing data
      await this.clearAllData();

      // Insert devices, tracks, parameters, and automation points
      for (const device of parsedALS.set.elektron) {
        const deviceId = await this.insertDevice(device, now);

        for (const track of device.tracks) {
          const trackId = await this.insertTrack(deviceId, track, now);

          for (const envelope of track.automationEnvelopes) {
            const parameterId = await this.insertParameter(trackId, envelope, now);
            await this.insertAutomationPoints(parameterId, envelope, now);
          }
        }
      }

      await this.run('COMMIT');
      console.log('✅ ALS data loaded successfully');

      // Print summary
      await this.printDatabaseSummary();
    } catch (error) {
      await this.run('ROLLBACK');
      console.error('❌ Failed to load ALS data:', error);
      throw error;
    }
  }

  private async clearAllData(): Promise<void> {
    await this.run('DELETE FROM automation_points');
    await this.run('DELETE FROM parameters');
    await this.run('DELETE FROM tracks');
    await this.run('DELETE FROM devices');
    await this.run('DELETE FROM edit_history');
  }

  private async insertDevice(device: ElektronDevice, timestamp: Date): Promise<string> {
    const deviceId = uuidv4();
    await this.run(
      'INSERT INTO devices (device_id, device_name, device_type, created_at) VALUES (?, ?, ?, ?)',
      [deviceId, device.deviceName, 'elektron', timestamp],
    );
    return deviceId;
  }

  private async insertTrack(
    deviceId: string,
    track: ElektronTrack,
    timestamp: Date,
  ): Promise<string> {
    const trackId = uuidv4();
    const lastEditTime = track.lastEditTime ? new Date(track.lastEditTime * 1000) : null;
    const trackName = `${track.deviceName} Track ${track.trackNumber}`;

    await this.run(
      'INSERT INTO tracks (track_id, device_id, track_number, track_name, is_muted, last_edit_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trackId, deviceId, track.trackNumber, trackName, track.isMuted, lastEditTime, timestamp],
    );
    return trackId;
  }

  private async insertParameter(
    trackId: string,
    envelope: AutomationEnvelope,
    timestamp: Date,
  ): Promise<string> {
    const parameterId = uuidv4();
    await this.run(
      'INSERT INTO parameters (parameter_id, track_id, parameter_name, parameter_path, min_value, max_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        parameterId,
        trackId,
        envelope.parameterName,
        envelope.id,
        envelope.minValue,
        envelope.maxValue,
        timestamp,
      ],
    );
    return parameterId;
  }

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
      INSERT INTO automation_points (point_id, parameter_id, time_position, value, curve_type, created_at)
      VALUES ${values}
    `;

    await this.run(sql);
  }

  async getDevicesWithTracks(): Promise<any[]> {
    return await this.run(`
      SELECT 
        d.device_id,
        d.device_name,
        d.device_type,
        COUNT(DISTINCT t.track_id) as track_count,
        COUNT(DISTINCT p.parameter_id) as parameter_count,
        COUNT(ap.point_id) as automation_point_count
      FROM devices d
      LEFT JOIN tracks t ON d.device_id = t.device_id
      LEFT JOIN parameters p ON t.track_id = p.track_id
      LEFT JOIN automation_points ap ON p.parameter_id = ap.parameter_id
      GROUP BY d.device_id, d.device_name, d.device_type
      ORDER BY d.device_name
    `);
  }

  async getTracksForDevice(deviceId: string): Promise<any[]> {
    return await this.run(
      `
      SELECT 
        t.track_id,
        t.track_number,
        t.track_name,
        t.is_muted,
        t.last_edit_time,
        COUNT(DISTINCT p.parameter_id) as parameter_count,
        COUNT(ap.point_id) as automation_point_count
      FROM tracks t
      LEFT JOIN parameters p ON t.track_id = p.track_id
      LEFT JOIN automation_points ap ON p.parameter_id = ap.parameter_id
      WHERE t.device_id = ?
      GROUP BY t.track_id, t.track_number, t.track_name, t.is_muted, t.last_edit_time
      ORDER BY t.track_number
    `,
      [deviceId],
    );
  }

  async getParametersForTrack(trackId: string): Promise<any[]> {
    return await this.run(
      `
      SELECT 
        p.parameter_id,
        p.parameter_name,
        p.parameter_path,
        p.min_value,
        p.max_value,
        COUNT(ap.point_id) as point_count,
        MIN(ap.time_position) as min_time,
        MAX(ap.time_position) as max_time
      FROM parameters p
      LEFT JOIN automation_points ap ON p.parameter_id = ap.parameter_id
      WHERE p.track_id = ?
      GROUP BY p.parameter_id, p.parameter_name, p.parameter_path, p.min_value, p.max_value
      ORDER BY p.parameter_name
    `,
      [trackId],
    );
  }

  async getTrackAutomation(trackId: string): Promise<any[]> {
    return await this.run(
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

  async getAutomationPoints(
    parameterId: string,
    startTime?: number,
    endTime?: number,
  ): Promise<any[]> {
    let sql = `
      SELECT time_position, value, curve_type
      FROM automation_points
      WHERE parameter_id = ?
    `;
    const params = [parameterId];

    if (startTime !== undefined) {
      sql += ' AND time_position >= ?';
      params.push(startTime);
    }
    if (endTime !== undefined) {
      sql += ' AND time_position <= ?';
      params.push(endTime);
    }

    sql += ' ORDER BY time_position';

    return await this.run(sql, params);
  }

  private async printDatabaseSummary(): Promise<void> {
    const devices = await this.run('SELECT COUNT(*) as count FROM devices');
    const tracks = await this.run('SELECT COUNT(*) as count FROM tracks');
    const parameters = await this.run('SELECT COUNT(*) as count FROM parameters');
    const automationPoints = await this.run('SELECT COUNT(*) as count FROM automation_points');

    console.log('📊 Database Summary:');
    console.log(`  Devices: ${devices[0].count}`);
    console.log(`  Tracks: ${tracks[0].count}`);
    console.log(`  Parameters: ${parameters[0].count}`);
    console.log(`  Automation Points: ${automationPoints[0].count}`);
  }

  async close(): Promise<void> {
    await this.adapter.close();
    console.log('✅ Database connection closed');
  }
}

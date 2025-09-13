import type { Device } from '../schema';
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
  async getDevicesWithTracks(): Promise<
    (Device & { trackCount: number; parameterCount: number; automationPointCount: number })[]
  > {
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

  async getDeviceById(deviceId: string): Promise<Device> {
    const devices = await this.db.run(
      `
      SELECT id, device_name, device_type, created_at FROM devices WHERE id = ?
    `,
      [deviceId],
    );
    if (devices.length === 0) {
      throw new Error(`Device with id ${deviceId} not found`);
    }

    return devices[0];
  }
}

import { CREATE_TABLES, CREATE_INDEXES, toSnakeCase, toCamelCase } from './schema';
import type { MidiMapping, ParsedALS, Track } from './schema';
import type { DatabaseAdapter } from './interface';
import { DeviceService } from './services/deviceService';
import { AutomationService } from './services/automationService';
import { TracksService } from './services/tracksService';
import { MuteTransitionService } from './services/muteTransitionService';
import { ElektronNameMatcher } from '$lib/config/regex';
import { v4 as uuidv4 } from 'uuid';

export class AutomationDatabase {
  private adapter: DatabaseAdapter;
  private isInitialized = false;

  // Service instances
  public readonly devices: DeviceService;
  public readonly tracks: TracksService;
  public readonly automation: AutomationService;
  public readonly muteTransitions: MuteTransitionService;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;

    // Initialize service instances with shared database methods
    this.devices = new DeviceService(this);
    this.tracks = new TracksService(this);
    this.automation = new AutomationService(this);
    this.muteTransitions = new MuteTransitionService(this);
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

  /**
   * Execute a SQL query with automatic camelCase conversion
   */
  async run(sql: string, params: any[] = []): Promise<any> {
    const results = await this.adapter.execute(sql, params);

    // Convert all snake_case keys to camelCase for TypeScript friendliness
    if (Array.isArray(results)) {
      return results.map((row) => toCamelCase(row));
    } else if (results && typeof results === 'object') {
      return toCamelCase(results);
    }

    return results;
  }

  /**
   * Helper method for inserting camelCase objects into snake_case database
   */
  async insertRecord(tableName: string, record: Record<string, any>): Promise<void> {
    const snakeCaseRecord = toSnakeCase(record);
    const keys = Object.keys(snakeCaseRecord);
    const values = Object.values(snakeCaseRecord).map((value) =>
      value === undefined ? null : value,
    );
    const placeholders = values.map(() => '?').join(',');

    const sql = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;

    await this.adapter.execute(sql, values);
  }

  /**
   * Load ALS data into the database using the device service
   */
  async loadALSData(parsedALS: ParsedALS, trackToName?: Record<string, string>): Promise<void> {
    console.log('📊 Loading ALS data into database...');

    try {
      await this.run('BEGIN TRANSACTION');
      await this.clearAllData();
      await this.devices.loadALSData(parsedALS, trackToName);
      await this.run('COMMIT');
      console.log('✅ ALS data loaded successfully');
      await this.printDatabaseSummary();
    } catch (error) {
      await this.run('ROLLBACK');
      console.error('❌ Failed to load ALS data:', error);
      throw error;
    }
  }

  /**
   * Clear all data from the database
   */
  private async clearAllData(): Promise<void> {
    await this.run('DELETE FROM automation_points');
    await this.run('DELETE FROM parameters');
    await this.run('DELETE FROM tracks');
    await this.run('DELETE FROM devices');
    await this.run('DELETE FROM edit_history');
  }

  /**
   * Print database summary statistics
   */
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

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.adapter.close();
    console.log('✅ Database connection closed');
  }

  // todo this should be moved to a service
  async createParameters(parameters: MidiMapping[]): Promise<void> {
    const tracks = await this.tracks.getAllTracks();
    const devices = await this.devices.getDevicesWithTracks();
    parameters.forEach(async (row) => {
      const device = devices.find((d) => d.deviceName === row.device);
      if (!device) {
        console.error('Could not find device', row.device);
        return;
      }
      const { isMute } = ElektronNameMatcher.parseMuteParameter(row.name);
      const trackNumber = ElektronNameMatcher.extractTrackNumber(row.name);
      if (!trackNumber) {
        console.error('Could not extract track number from parameter name', row.name);
        return;
      }
      let track: Track | null | undefined = tracks.find(
        (t) => t.deviceId === device.id && t.trackNumber === trackNumber,
      );
      if (!track) {
        if (!isMute) {
          console.error('Could not find track', row.device, trackNumber);
          return;
        }
        // we need to create a new track
        track = await this.tracks.createTrack({
          id: uuidv4(),
          deviceId: device.id,
          trackNumber,
          trackName: row.name,
          createdAt: new Date(),
        });
      }
      if (!track) {
        console.error('Could not create track', row.device, trackNumber);
        return;
      }
      this.tracks.createParameter({
        id: uuidv4(),
        trackId: track.id, // Foreign key to tracks
        parameterName: row.name, // e.g., "Filter Cutoff", "Volume"
        parameterPath: `${device.deviceName}/${row.name}`, // Full automation target path from ALS
        vstParameterId: row.paramId, // Parameter ID defined by the VST
        // Original PointeeId from ALS XML, which corresponds to AutomationEnvelope.
        // Null if the parameter was added in Overglass
        originalPointeeId: null,
        isMute: isMute, // Whether this parameter is a mute parameter
        createdAt: new Date(),
      });
    });
  }
}

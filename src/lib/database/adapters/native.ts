import * as duckdb from 'duckdb';
import type { DatabaseAdapter } from '../interface';

export class NativeDuckDBAdapter implements DatabaseAdapter {
  private db: duckdb.Database;
  private connection: duckdb.Connection;
  private isInitialized = false;
  private filePath?: string;

  constructor(filePath?: string) {
    // Create in-memory database by default, or file-based if path provided
    this.filePath = filePath;
    this.db = new duckdb.Database(filePath || ':memory:');
    this.connection = this.db.connect();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async execute(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, ...params, (err: Error | null, result: any) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
  }

  async close(): Promise<void> {
    this.connection.close();
    this.db.close();
  }

  /**
   * Get the file path if this is a file-based database
   */
  getFilePath(): string | undefined {
    return this.filePath;
  }
}

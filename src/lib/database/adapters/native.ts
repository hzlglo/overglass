import * as duckdb from 'duckdb';
import type { DatabaseAdapter } from '../interface';

export class NativeDuckDBAdapter implements DatabaseAdapter {
  private db: duckdb.Database;
  private connection: duckdb.Connection;
  private isInitialized = false;

  constructor() {
    // Create in-memory database
    this.db = new duckdb.Database(':memory:');
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
}

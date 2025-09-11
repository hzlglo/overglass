import * as duckdb from '@duckdb/duckdb-wasm';
import type { DatabaseAdapter } from '../interface';

export class WasmDuckDBAdapter implements DatabaseAdapter {
  private db: duckdb.AsyncDuckDB | null = null;
  private connection: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Use local DuckDB WASM files instead of CDN to avoid CORS issues
      const bundle: duckdb.DuckDBBundle = {
        mainModule: '/duckdb-mvp.wasm',
        mainWorker: '/duckdb-browser-mvp.worker.js',
        pthreadWorker: '/duckdb-browser-eh.worker.js',
      };

      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      this.connection = await this.db.connect();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize DuckDB WASM:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

    try {
      // For queries with parameters, we need to use prepared statements
      if (params.length > 0) {
        const stmt = await this.connection.prepare(sql);
        const result = await stmt.query(...params);
        await stmt.close();
        return result.toArray().map((row) => Object.fromEntries(row));
      } else {
        // For simple queries without parameters
        const result = await this.connection.query(sql);
        return result.toArray().map((row) => Object.fromEntries(row));
      }
    } catch (error) {
      console.error('SQL Error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
    if (this.db) {
      await this.db.terminate();
    }
  }
}

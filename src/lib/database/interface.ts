// Generic database interface for dependency injection
export interface DatabaseAdapter {
  initialize(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}

export interface DatabaseConnection {
  query(sql: string): Promise<any>;
  prepare(sql: string): Promise<DatabaseStatement>;
}

export interface DatabaseStatement {
  query(...params: any[]): Promise<any>;
  close(): Promise<void>;
}

export interface DatabaseResult {
  toArray(): any[];
}

// Generic database interface for dependency injection
export interface DatabaseAdapter {
  initialize(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}

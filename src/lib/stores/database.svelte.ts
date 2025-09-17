import { AutomationDatabase } from '../database/duckdb';
import { WasmDuckDBAdapter } from '../database/adapters/wasm';
import type { ParsedALS } from '../types/automation';

let creatingDb = false;

const createAutomationDbStore = () => {
  let database: AutomationDatabase | null = $state(null);
  let isRecalculating = $state(false);

  // This reactive trigger ensures all queries recompute when the db updates
  let lastDbUpdateAt = $state(new Date());

  const query = async (sql: string, params: any[] = []) => {
    if (!database) {
      console.error('Database not initialized');
      return [];
    }
    // Call the private run method through the adapter
    return await database['adapter'].execute(sql, params);
  };

  const refreshData = async () => {
    isRecalculating = true;
    // Trigger reactive updates
    lastDbUpdateAt = new Date();
    isRecalculating = false;
  };

  const init = async () => {
    if (database) {
      console.error('Cannot init - database already initialized');
      return;
    }
    if (creatingDb) {
      console.error('Cannot init - database already initializing');
      return;
    }

    creatingDb = true;
    try {
      const adapter = new WasmDuckDBAdapter();

      database = new AutomationDatabase(adapter);
      await database.initialize();
    } finally {
      creatingDb = false;
    }
  };

  const loadALSData = async (parsedALS: ParsedALS) => {
    if (!database) {
      throw new Error('Database not initialized');
    }
    await database.loadALSData(parsedALS);
    await refreshData();
  };

  const updateDb = async (editSql: string, params: any[] = []) => {
    await query(editSql, params);
    await refreshData();
  };

  return {
    init,
    destroy: async () => {
      if (database) {
        // Void rather than await to ensure immediate cleanup
        void database.close();
        database = null;
      }
    },
    refreshData,
    loadALSData,
    updateDb,
    isInitialized: () => database !== null,
    get: (): AutomationDatabase => {
      if (!database) {
        throw new Error('database not initialized');
      }
      return ((_x: any) => database)(lastDbUpdateAt);
    },
    isRecalculating: () => isRecalculating,
  };
};

export const automationDb = createAutomationDbStore();

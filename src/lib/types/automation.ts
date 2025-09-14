// Re-export schema types for consistency
export type {
  Device,
  Track,
  Parameter,
  AutomationPoint,
  EditHistory,
  ParameterStats,
} from '../database/schema';

export interface ParsedALS {
  name: string;
  bpm: number;
  rawXML?: Document;
}

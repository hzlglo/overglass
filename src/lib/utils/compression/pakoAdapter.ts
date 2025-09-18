import { gzip, ungzip } from 'pako';
import type { CompressionAdapter } from './compressionAdapter';

/**
 * Compression adapter using pako library (works in both Node.js and browser)
 * Always uses gzip format to match original ALS file format
 */
export class PakoCompressionAdapter implements CompressionAdapter {
  async compress(data: string): Promise<Uint8Array> {
    try {
      // Use pako's gzip to compress the string (matches original ALS format)
      return gzip(data);
    } catch (error) {
      throw new Error(`Failed to compress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decompress(data: Uint8Array): Promise<string> {
    try {
      // Use pako's ungzip to decompress gzip format
      return ungzip(data, { to: 'string' });
    } catch (error) {
      throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
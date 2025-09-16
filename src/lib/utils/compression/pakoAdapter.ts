import { deflate, inflate } from 'pako';
import type { CompressionAdapter } from './compressionAdapter';

/**
 * Compression adapter using pako library (works in both Node.js and browser)
 */
export class PakoCompressionAdapter implements CompressionAdapter {
  async compress(data: string): Promise<Uint8Array> {
    try {
      // Use pako's deflate to compress the string
      return deflate(data);
    } catch (error) {
      throw new Error(`Failed to compress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decompress(data: Uint8Array): Promise<string> {
    try {
      // Use pako's inflate to decompress back to string
      return inflate(data, { to: 'string' });
    } catch (error) {
      throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
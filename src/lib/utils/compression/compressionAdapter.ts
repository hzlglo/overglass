/**
 * Compression adapter interface for handling different compression methods
 * across browser and Node.js environments
 */
export interface CompressionAdapter {
  /**
   * Compress a string to a Uint8Array
   */
  compress(data: string): Promise<Uint8Array>;

  /**
   * Decompress a Uint8Array back to a string
   */
  decompress(data: Uint8Array): Promise<string>;
}
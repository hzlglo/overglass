import type { CompressionAdapter } from './compressionAdapter';

/**
 * Compression adapter using browser's native CompressionStream API
 * Only works in modern browsers that support the Compression Streams API
 */
export class BrowserCompressionAdapter implements CompressionAdapter {
  async compress(data: string): Promise<Uint8Array> {
    try {
      // Check if CompressionStream is available
      if (!('CompressionStream' in window)) {
        throw new Error('CompressionStream not supported in this browser');
      }

      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Write the string data
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(data));
      await writer.close();

      // Read the compressed result
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to compress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decompress(data: Uint8Array): Promise<string> {
    try {
      // Check if DecompressionStream is available
      if (!('DecompressionStream' in window)) {
        throw new Error('DecompressionStream not supported in this browser');
      }

      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Write the compressed data
      await writer.write(data);
      await writer.close();

      // Read the decompressed result
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine all chunks and decode to string
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      return decoder.decode(result);
    } catch (error) {
      throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
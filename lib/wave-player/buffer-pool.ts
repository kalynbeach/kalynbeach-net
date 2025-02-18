import { WavePlayerTrack } from "@/lib/types/wave-player";

export interface WavePlayerBufferPoolState {
  current: AudioBuffer | null;
  next: AudioBuffer | null;
  chunks: Map<string, AudioBuffer>;
  maxPoolSize: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export interface WavePlayerBufferPoolOptions {
  maxPoolSize?: number;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export class WavePlayerBufferPool {
  private pool: WavePlayerBufferPoolState;
  private chunkSize: number;
  private abortController: AbortController | null = null;

  constructor(options: WavePlayerBufferPoolOptions = {}) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB default
    this.pool = {
      current: null,
      next: null,
      chunks: new Map(),
      maxPoolSize: options.maxPoolSize || 100 * 1024 * 1024, // 100MB default
      onProgress: options.onProgress,
      onError: options.onError,
    };
  }

  async loadTrackChunked(track: WavePlayerTrack, audioContext: AudioContext) {
    try {
      this.abortController = new AbortController();
      
      // Initial metadata fetch using Bun's fetch
      const head = await fetch(track.src, { 
        method: "HEAD",
        signal: this.abortController.signal 
      });
      
      const contentLength = parseInt(head.headers.get("Content-Length") || "0");
      if (!contentLength) throw new Error("Content length not available");

      // Calculate optimal chunk size based on content length
      const optimalChunkSize = Math.min(
        this.chunkSize,
        Math.ceil(contentLength / 10)
      );

      const chunks: ArrayBuffer[] = [];
      let loadedBytes = 0;

      for (let offset = 0; offset < contentLength; offset += optimalChunkSize) {
        if (this.abortController.signal.aborted) {
          throw new Error("Loading aborted");
        }

        const end = Math.min(offset + optimalChunkSize - 1, contentLength - 1);
        const response = await fetch(track.src, {
          headers: { Range: `bytes=${offset}-${end}` },
          signal: this.abortController.signal,
        });

        const chunk = await response.arrayBuffer();
        chunks.push(chunk);
        loadedBytes += chunk.byteLength;

        // Report progress
        const progress = (loadedBytes / contentLength) * 100;
        this.pool.onProgress?.(progress);

        // Process chunk if we have enough data
        if (chunks.length >= 2) {
          const partialBuffer = await this.decodeChunks(chunks, audioContext);
          const chunkKey = `${track.id}-${offset}`;
          this.pool.chunks.set(chunkKey, partialBuffer);
          this.managePoolSize();
        }
      }

      // Final processing
      const fullBuffer = await this.decodeChunks(chunks, audioContext);
      
      // Update pool
      if (this.pool.current) {
        this.pool.next = this.pool.current;
      }
      this.pool.current = fullBuffer;

      return fullBuffer;
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error("Track loading failed");
      this.pool.onError?.(finalError);
      throw finalError;
    }
  }

  async preloadTrack(track: WavePlayerTrack, audioContext: AudioContext) {
    try {
      const buffer = await this.loadTrackChunked(track, audioContext);
      this.pool.next = buffer;
      return buffer;
    } catch (error) {
      // Silently handle preload errors
      console.warn("[WavePlayerBufferPool] Preload failed:", error);
      return null;
    }
  }

  private async decodeChunks(chunks: ArrayBuffer[], context: AudioContext): Promise<AudioBuffer> {
    const combined = await this.combineArrayBuffers(chunks);
    return await context.decodeAudioData(combined);
  }

  private async combineArrayBuffers(chunks: ArrayBuffer[]): Promise<ArrayBuffer> {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combined = new ArrayBuffer(totalLength);
    const view = new Uint8Array(combined);
    
    let offset = 0;
    for (const chunk of chunks) {
      view.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    return combined;
  }

  private managePoolSize(): void {
    let totalSize = 0;
    const entries = Array.from(this.pool.chunks.entries());
    
    // Sort by age (assuming keys contain timestamps)
    entries.sort(([a], [b]) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
    
    for (const [key, buffer] of entries) {
      totalSize += buffer.length * 4; // Approximate size in bytes
      if (totalSize > this.pool.maxPoolSize) {
        this.pool.chunks.delete(key);
      }
    }
  }

  public abort(): void {
    this.abortController?.abort();
  }

  public cleanup(): void {
    this.pool.chunks.clear();
    this.pool.current = null;
    this.pool.next = null;
    this.abort();
  }

  // Getters for current state
  public getCurrentBuffer(): AudioBuffer | null {
    return this.pool.current;
  }

  public getNextBuffer(): AudioBuffer | null {
    return this.pool.next;
  }
}

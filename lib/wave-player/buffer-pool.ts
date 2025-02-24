import { WavePlayerTrack, WavePlayerBufferPoolState, WavePlayerBufferPoolOptions } from "@/lib/types/wave-player";

/**
 * Core audio buffer management system for `WavePlayer`.
 * Implements efficient chunked loading and buffer management for optimal audio streaming.
 */
export class WavePlayerBufferPool {
  private pool: WavePlayerBufferPoolState;
  private abortController: AbortController | null = null;
  private readonly chunkSize: number;
  private readonly maxPoolSize: number;
  private totalBufferSize = 0;

  constructor(options: WavePlayerBufferPoolOptions = {}) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB default chunk size
    this.maxPoolSize = options.maxPoolSize || 100 * 1024 * 1024; // 100MB default pool size
    this.pool = {
      current: null,
      next: null,
      chunks: new Map(),
      maxPoolSize: this.maxPoolSize,
      onProgress: options.onProgress,
      onError: options.onError,
    };
  }

  async loadTrackChunked(track: WavePlayerTrack, audioContext: AudioContext) {
    try {
      // Don't cleanup if we're loading into next buffer slot
      if (!this.pool.next) {
        this.cleanup();
      }
      
      this.abortController = new AbortController();
      
      // Get file size for chunk calculation
      const head = await fetch(track.src, { 
        method: "HEAD",
        signal: this.abortController.signal 
      });
      
      const contentLength = parseInt(head.headers.get("Content-Length") || "0");
      if (!contentLength) throw new Error("Content length not available");

      // Load the complete audio file in chunks
      const chunks: ArrayBuffer[] = [];
      let loadedBytes = 0;

      for (let offset = 0; offset < contentLength; offset += this.chunkSize) {
        if (this.abortController?.signal.aborted) {
          throw new Error("Loading aborted");
        }

        const end = Math.min(offset + this.chunkSize - 1, contentLength - 1);
        const response = await fetch(track.src, {
          headers: { Range: `bytes=${offset}-${end}` },
          signal: this.abortController.signal,
        });

        const chunk = await response.arrayBuffer();
        chunks.push(chunk);
        loadedBytes += chunk.byteLength;

        // Report loading progress
        const progress = (loadedBytes / contentLength) * 100;
        this.pool.onProgress?.(progress);
      }

      // Combine all chunks into a single buffer
      const completeBuffer = await this.combineArrayBuffers(chunks);
      
      try {
        // Decode the complete audio file
        const audioBuffer = await audioContext.decodeAudioData(completeBuffer);
        
        // Store in appropriate pool slot
        if (this.pool.next === null) {
          this.pool.current = audioBuffer;
        } else {
          this.pool.next = audioBuffer;
        }
        
        this.totalBufferSize = (this.pool.current?.length || 0) * 4 + 
                              (this.pool.next?.length || 0) * 4; // 32-bit float samples
        
        // Manage pool size if needed
        this.managePoolSize();
        
        return audioBuffer;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        throw new Error("Unable to decode audio data: " + message);
      }
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error("Track loading failed");
      this.pool.onError?.(finalError);
      throw finalError;
    }
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
    if (this.totalBufferSize > this.maxPoolSize) {
      // Clear old chunks and next buffer to free memory
      this.pool.chunks.clear();
      this.pool.next = null;
      
      // Keep track of current buffer size only
      this.totalBufferSize = this.pool.current ? this.pool.current.length * 4 : 0;
    }
  }

  public setNextBuffer(buffer: AudioBuffer | null): void {
    this.pool.next = buffer;
    this.totalBufferSize = (this.pool.current?.length || 0) * 4 + 
                          (this.pool.next?.length || 0) * 4;
    this.managePoolSize();
  }

  public promoteNextBuffer(): void {
    if (this.pool.next) {
      this.pool.current = this.pool.next;
      this.pool.next = null;
      this.totalBufferSize = this.pool.current.length * 4;
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public cleanup(): void {
    this.pool.chunks.clear();
    this.pool.current = null;
    this.pool.next = null;
    this.totalBufferSize = 0;
    this.abort();
  }

  public getCurrentBuffer(): AudioBuffer | null {
    return this.pool.current;
  }

  public getNextBuffer(): AudioBuffer | null {
    return this.pool.next;
  }
}

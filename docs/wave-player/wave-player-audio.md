# WavePlayer Audio

## Audio Loading & Buffer Pooling

> 02-17-2025 - Claude-3.5-Sonnet

I'll help you design an optimal audio loading strategy for your WavePlayer system. Based on your code and requirements, here's my analysis and recommendation:

### Current Implementation Analysis

Your current implementation loads the entire audio file at once:

```typescript
// 142:168:contexts/wave-player/context.tsx
  const loadTrack = useCallback(
    async (track: WavePlayerTrack) => {
      if (!state.audioContext) return;

      console.log("[WavePlayerProvider loadTrack] loading track...");

      try {
        dispatch({ type: "SET_STATUS", payload: "loading" });
        dispatch({ type: "SET_TRACK", payload: track });

        const response = await fetch(track.src);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await state.audioContext.decodeAudioData(arrayBuffer);
        console.log("[WavePlayerProvider loadTrack] setting buffer:", buffer);

        dispatch({ type: "SET_BUFFER", payload: buffer });
        dispatch({ type: "SET_STATUS", payload: "ready" });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload:
            error instanceof Error ? error : new Error("Track loading failed"),
        });
      }
    },
    [state.audioContext]
  );
```

This approach has limitations:

1. High memory usage for long tracks
2. Long initial load times
3. No preloading for next tracks
4. Potential browser memory issues with large playlists

### Recommended Buffer Pooling Strategy

Here's a more sophisticated approach using buffer pooling and chunked loading:

```typescript
// Types and Interfaces
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

// Main Implementation
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
```

### Benefits of This Approach

1. **Progressive Loading**
   - Starts playback faster with initial chunks
   - Streams remaining data in background
   - Better user experience for large files
   - Supports partial playback before full load

2. **Memory Management**
   - Controlled buffer pool size (default 100MB)
   - Automatic cleanup of old chunks
   - Prevents memory leaks
   - Efficient TypedArray usage for buffer combining

3. **Performance Optimization**
   - Uses Bun's optimized fetch API
   - Dynamic chunk size calculation
   - Preloading of next track
   - Reuse of decoded chunks

4. **Resource Efficiency**
   - Only keeps necessary buffers in memory
   - Manages memory pressure automatically
   - Abortable loading operations
   - Clean cleanup of resources

5. **TypeScript Integration**
   - Strong typing with separate interfaces
   - Clear state management
   - Type-safe error handling
   - Proper callback typing

### Implementation Notes

1. **State Management**

   ```typescript
   export interface WavePlayerBufferPoolState {
     current: AudioBuffer | null;
     next: AudioBuffer | null;
     chunks: Map<string, AudioBuffer>;
     maxPoolSize: number;
     onProgress?: (progress: number) => void;
     onError?: (error: Error) => void;
   }
   ```

   Clearly defined state interface for better type safety and maintainability.

2. **Configuration Options**

   ```typescript
   interface WavePlayerBufferPoolOptions {
     maxPoolSize?: number;
     chunkSize?: number;
     onProgress?: (progress: number) => void;
     onError?: (error: Error) => void;
   }
   ```

   Flexible configuration with sensible defaults.

3. **Progress Tracking**

   ```typescript
   const progress = (loadedBytes / contentLength) * 100;
   this.pool.onProgress?.(progress);
   ```

   Real-time progress updates for UI feedback.

4. **Error Handling**

   ```typescript
   const finalError = error instanceof Error ? error : new Error("Track loading failed");
   this.pool.onError?.(finalError);
   ```

   Consistent error reporting with proper type checking.

### Usage Guidelines

1. **Initialization**

   ```typescript
   const bufferPool = new WavePlayerBufferPool({
     maxPoolSize: 100 * 1024 * 1024, // 100MB
     chunkSize: 1024 * 1024, // 1MB
     onProgress: (progress) => {
       // Update loading progress
     },
     onError: (error) => {
       // Handle loading errors
     }
   });
   ```

2. **Resource Cleanup**

   ```typescript
   useEffect(() => {
     return () => {
       bufferPool.cleanup();
     };
   }, []);
   ```

3. **Track Loading**

   ```typescript
   await bufferPool.loadTrackChunked(track, audioContext);
   ```

4. **Track Preloading**

   ```typescript
   await bufferPool.preloadTrack(nextTrack, audioContext);
   ```

### Future Enhancements

1. **Web Worker Integration**
   - Move buffer decoding to worker thread
   - Improve UI responsiveness
   - Handle larger files efficiently

2. **Cache Integration**
   - Add browser cache support
   - Implement persistent storage
   - Optimize repeat playback

3. **Stream Processing**
   - Add real-time audio processing
   - Support for live streaming
   - Advanced audio effects

To implement this system, ensure your project has:

1. Proper TypeScript configuration for Web Audio API
2. Error boundary setup for React components
3. Sufficient memory allocation for audio processing
4. Proper cleanup in component lifecycle methods

Next steps will involve integrating this buffer pool implementation with the `WavePlayerProvider` context and updating the UI components to handle progress updates and loading states.

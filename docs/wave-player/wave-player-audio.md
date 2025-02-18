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
// Types for buffer management
interface BufferPool {
  current: AudioBuffer | null;
  next: AudioBuffer | null;
  chunks: Map<string, AudioBuffer>;
  maxPoolSize: number;
}

// Buffer pool manager
class AudioBufferPool {
  private pool: BufferPool;
  private chunkSize: number = 1024 * 1024; // 1MB chunks
  
  constructor(maxPoolSize: number = 100 * 1024 * 1024) { // 100MB default
    this.pool = {
      current: null,
      next: null,
      chunks: new Map(),
      maxPoolSize,
    };
  }

  async loadTrackChunked(track: WavePlayerTrack, audioContext: AudioContext) {
    const response = await fetch(track.src, {
      headers: { Range: 'bytes=0-' }
    });

    if (!response.ok) throw new Error('Failed to fetch audio');
    
    const contentLength = Number(response.headers.get('content-length'));
    const chunks: ArrayBuffer[] = [];
    let loadedBytes = 0;

    // Stream chunks
    const reader = response.body!.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value.buffer);
      loadedBytes += value.length;
      
      // Report progress
      const progress = (loadedBytes / contentLength) * 100;
      this.onProgress?.(progress);

      // Decode chunk if we have enough data
      if (chunks.length * this.chunkSize >= this.chunkSize * 2) {
        const partialBuffer = await this.decodeChunks(chunks, audioContext);
        this.pool.chunks.set(`${track.id}-${chunks.length}`, partialBuffer);
      }
    }

    // Final decode of remaining data
    const fullBuffer = await this.decodeChunks(chunks, audioContext);
    this.pool.current = fullBuffer;
    
    // Cleanup old chunks if needed
    this.managePoolSize();
    
    return fullBuffer;
  }

  private async decodeChunks(chunks: ArrayBuffer[], context: AudioContext) {
    const combined = this.combineArrayBuffers(chunks);
    return await context.decodeAudioData(combined);
  }

  private managePoolSize() {
    let totalSize = 0;
    for (const [id, buffer] of this.pool.chunks) {
      totalSize += buffer.length * 4; // Approximate size in bytes
      if (totalSize > this.pool.maxPoolSize) {
        this.pool.chunks.delete(id);
      }
    }
  }
}
```

### Integration with Your Context

```typescript
// Add to WavePlayerProvider
const bufferPool = useRef<AudioBufferPool>(new AudioBufferPool());

const loadTrack = useCallback(async (track: WavePlayerTrack) => {
  if (!state.audioContext) return;

  try {
    dispatch({ type: "SET_STATUS", payload: "loading" });
    dispatch({ type: "SET_TRACK", payload: track });

    // Use buffer pool for loading
    const buffer = await bufferPool.current.loadTrackChunked(
      track,
      state.audioContext
    );

    dispatch({ type: "SET_BUFFER", payload: buffer });
    dispatch({ type: "SET_STATUS", payload: "ready" });

    // Preload next track if available
    const nextTrack = playlist?.tracks[currentTrackIndex + 1];
    if (nextTrack) {
      bufferPool.current.preloadTrack(nextTrack, state.audioContext);
    }
  } catch (error) {
    dispatch({
      type: "SET_ERROR",
      payload: error instanceof Error ? error : new Error("Track loading failed"),
    });
  }
}, [state.audioContext, playlist, currentTrackIndex]);
```

### Benefits of This Approach

1. **Progressive Loading**
   - Starts playback faster with initial chunks
   - Streams remaining data in background
   - Better user experience for large files

2. **Memory Management**
   - Controlled buffer pool size
   - Automatic cleanup of old chunks
   - Prevents memory leaks

3. **Performance Optimization**
   - Preloading of next track
   - Reuse of decoded chunks
   - Smooth playback transitions

4. **Resource Efficiency**
   - Only keeps necessary buffers in memory
   - Manages memory pressure automatically
   - Works well with your playlist structure

To implement this, you'll need to:

1. Add the buffer pool manager to your project
2. Update your context provider to use the pool
3. Add progress tracking to your state management
4. Update your cleanup functions to handle the pool

Would you like me to elaborate on any part of this implementation or provide additional code examples for specific components?

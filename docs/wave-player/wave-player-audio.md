# WavePlayer Audio

Core audio loading and processing for `WavePlayer`.

## Overview

The WavePlayer system is a modern, React-based audio player implementation built with Next.js 15 and React 19. It utilizes the Web Audio API for high-fidelity audio playback and processing, with a focus on efficient memory management and optimal performance.

## Architecture

### Core Components

1. **Buffer Management**
   - Implements an efficient buffer pool system (`WavePlayerBufferPool`) for audio data management
   - Uses chunked loading for efficient data transfer (default 1MB chunks)
   - Maintains memory constraints with a default 100MB pool size limit
   - Combines chunks before decoding to ensure audio integrity

2. **State Management**
   - Uses React Context (`WavePlayerContext`) for global state management
   - Implements a robust state machine with clear status transitions:
     - `idle` → `loading` → `ready` → `playing` ↔ `paused`
   - Tracks essential playback state:
     - Current track and playlist information
     - Playback progress and duration
     - Audio buffer and loading progress
     - Visualization data (waveform and frequencies)

3. **Audio Processing**
   - Leverages Web Audio API's `AudioContext` for high-quality audio processing
   - Maintains a single global `AudioContext` instance for efficiency
   - Supports essential audio node types:
     - `AudioBufferSourceNode` for playback
     - `AnalyserNode` for visualization
     - `GainNode` for volume control
   - Implements thorough cleanup and resource management

### Key Features

1. **Optimized Loading**
   - Audio files are loaded in configurable chunks for efficient transfer
   - Complete audio data is combined before decoding
   - Progress tracking during loading
   - Efficient memory usage through buffer pool management

2. **Track Management**
   - Support for playlists with multiple tracks
   - Proper cleanup between track transitions
   - Seamless track transitions
   - Loop support for individual tracks

3. **Visualization**
   - Real-time waveform visualization
   - Frequency analysis support
   - Optimized canvas-based rendering
   - Support for different visualization modes

## Implementation Details

### Buffer Pool System

The `WavePlayerBufferPool` class implements an efficient memory management system:

```typescript
class WavePlayerBufferPool {
  // Core properties
  private pool: WavePlayerBufferPoolState;
  private chunkSize: number;
  private abortController: AbortController | null;

  // Memory management
  private managePoolSize(): void {
    // Cleans up old chunks when pool size exceeds limit
    // Maintains single complete buffer for current track
  }

  // Chunked loading
  async loadTrackChunked(track: WavePlayerTrack, audioContext: AudioContext) {
    // Loads audio file in efficient chunks
    // Combines chunks before decoding
    // Ensures audio integrity
    // Provides progress tracking
  }
}
```

### Audio Context Management

The system maintains a single global `AudioContext` instance:

```typescript
// Single global audio context instance
let globalAudioContext: AudioContext | null = null;

function createAudioContext() {
  // Reuse existing context if available
  if (globalAudioContext) {
    if (globalAudioContext.state === "suspended") {
      globalAudioContext.resume();
    }
    return globalAudioContext;
  }

  // Create new context if needed
  const ctx = new AudioContext({
    latencyHint: "interactive",
    sampleRate: 48000,
  });
  globalAudioContext = ctx;
  return ctx;
}
```

## Best Practices

1. **Memory Management**
   - Load audio in efficient chunks
   - Combine chunks before decoding
   - Clean up resources properly
   - Maintain single global audio context

2. **Error Handling**
   - Graceful fallbacks for loading failures
   - Clear error messages for decoding issues
   - Proper abort handling
   - Progress tracking

3. **Performance**
   - Efficient chunk loading
   - Single decode operation
   - Proper cleanup
   - Resource reuse

## Current Status

1. **Completed Improvements**
   - ✅ Implemented proper chunked loading
   - ✅ Fixed audio decoding issues
   - ✅ Improved memory management
   - ✅ Added proper cleanup

2. **Future Enhancements**
   - Web Worker implementation for processing
   - Enhanced visualization options
   - Audio effects processing
   - Advanced preloading strategies

## Dependencies

The system relies on several key dependencies:

- React 19 with React Compiler
- Next.js 15
- Web Audio API
- Canvas API for visualization
- Radix UI components for UI elements

## Best Practices

1. **Memory Management**
   - Implement proper cleanup of audio nodes
   - Manage buffer pool size
   - Handle resource cleanup on unmount

2. **Error Handling**
   - Graceful fallbacks for loading failures
   - Clear error messages
   - Retry mechanisms

3. **Performance**
   - Efficient state updates
   - Optimized visualization rendering
   - Smart preloading strategies

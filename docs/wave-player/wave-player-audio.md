# WavePlayer Audio

Core audio loading and processing for `WavePlayer`.

## Overview

The WavePlayer system is a modern, React-based audio player implementation built with Next.js 15 and React 19. It utilizes the Web Audio API for high-fidelity audio playback and processing, with a focus on efficient memory management and optimal performance.

## Architecture

### Core Components

1. **Buffer Management**
   - Implements a sophisticated buffer pool system (`WavePlayerBufferPool`) for efficient audio data management
   - Uses chunked loading strategy with configurable chunk sizes (default 1MB)
   - Maintains memory constraints with a default 100MB pool size limit
   - Supports preloading of next tracks for seamless playback

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
   - Supports various audio node types:
     - `AudioBufferSourceNode` for playback
     - `AnalyserNode` for visualization
     - `GainNode` for volume control
   - Implements efficient cleanup and resource management

### Key Features

1. **Chunked Loading**
   - Audio files are loaded in configurable chunks
   - Progress tracking during loading
   - Efficient memory usage through buffer pool management
   - Automatic cleanup of old chunks when memory limits are reached

2. **Track Management**
   - Support for playlists with multiple tracks
   - Automatic preloading of next track
   - Seamless track transitions
   - Loop support for individual tracks

3. **Visualization**
   - Real-time waveform visualization
   - Frequency analysis support
   - Canvas-based rendering
   - Support for different visualization modes (waveform, image, scene)

## Implementation Details

### Buffer Pool System

The `WavePlayerBufferPool` class implements a sophisticated memory management system:

```typescript
class WavePlayerBufferPool {
  // Core properties
  private pool: WavePlayerBufferPoolState;
  private chunkSize: number;
  private abortController: AbortController | null;

  // Memory management
  private managePoolSize(): void {
    // Implements LRU-style cache management
    // Removes oldest chunks when pool size exceeds limit
  }

  // Chunked loading
  async loadTrackChunked(track: WavePlayerTrack, audioContext: AudioContext) {
    // Implements efficient chunked loading with progress tracking
    // Supports abort functionality
    // Manages memory constraints
  }
}
```

### State Management

The system uses a well-defined state machine with clear transitions and actions:

```typescript
type WavePlayerAction =
  | { type: "INITIALIZE"; payload: { audioContext: AudioContext } }
  | { type: "SET_BUFFER"; payload: AudioBuffer | null }
  | { type: "SET_TRACK"; payload: WavePlayerTrack | null }
  | { type: "SET_STATUS"; payload: WavePlayerState["status"] }
  // ... additional actions
```

## Current Issues & TODOs

1. **State Management**
   - ✅ Duration calculation and updates now working correctly
   - ⚠️ Some state values still need proper updates when controls are used
   - ⚠️ Bug with state causing re-renders during status transitions (e.g., playing → paused)
   - ✅ Fixed `currentTime` continuing to increment after track end

2. **Track Loading**
   - ⚠️ `loadTrack` implementation needs optimization review
   - ✅ Basic buffer loading UI implemented with progress bar
   - ⚠️ Buffer loading UI could be improved for better user experience

3. **UI Components**
   - ✅ Improved `Card` layout and section styles
   - ✅ Fixed progress `Slider` value updates
   - ✅ Fixed progress `Slider` time display updates
   - ⚠️ Progress `Slider` seeking functionality needs improvement
   - ⚠️ Styles need improvement for larger screens
   - ⚠️ Track info and controls styles need cleanup

4. **Visualization**
   - ⚠️ Initial canvas skeleton needed for pre-playback state
   - ⚠️ Visualization styles need improvement
   - ⚠️ Additional visualization modes to be implemented

## Future Improvements

1. **Performance Optimizations**
   - Implement Web Worker for audio processing
   - Optimize state update frequency
   - Improve memory management strategies

2. **Feature Enhancements**
   - Add playlist management
   - Implement more visualization options
   - Add audio effects processing
   - Improve preloading strategies

3. **Developer Experience**
   - Add comprehensive error handling
   - Improve debugging capabilities
   - Add performance monitoring

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


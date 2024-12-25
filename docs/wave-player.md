# wave-player

A streaming music player powered by the Web Audio API.

## Types

- `WavePlayerTrack`: Represents a single audio track with metadata
- `WavePlayerPlaylist`: Collection of WavePlayerTracks
- `WavePlayerState`: Current state of the player (loading, playing, paused, etc.)
- `WavePlayerControls`: Player control functions (play, pause, seek, etc.)

## Contexts

- `WavePlayerContext`: Manages global player state and audio processing
  - Handles AudioContext lifecycle
  - Manages audio nodes (source, gain, analyser)
  - Provides track state and controls
  - Handles audio buffer loading and caching

## Hooks

- `useWavePlayer`: Core hook for player functionality
  - Initializes and manages AudioContext
  - Sets up audio processing nodes
  - Handles track loading and buffering
  - Manages playback state and controls
  - Provides audio analysis data for visualizations

## Components

- `WavePlayer` (`Card`)
  - `WavePlayerInfo` (in `CardHeader`)
    - Track title, artist, record info
    - Album/track artwork
  - `WavePlayerVisuals` (in `CardContent`)
    - Frequency visualization
    - Waveform display
    - Progress indicator
  - `WavePlayerControls` (in `CardFooter`)
    - Play/Pause
    - Previous/Next track
    - Volume control
    - Progress bar/seek
    - Loop/Shuffle controls

## Implementation Plan

### 1. Audio Processing Setup

1. Initialize AudioContext and nodes:
   - Create AudioContext with optimal settings
   - Set up GainNode for volume control
   - Configure AnalyserNode for visualizations
   - Create AudioBufferSourceNode for playback

2. Buffer Management:
   - Implement efficient audio buffer loading
   - Cache loaded buffers for quick track switching
   - Handle buffer cleanup for memory optimization

### 2. State Management

1. WavePlayerContext:
   - Track current playback state
   - Manage playlist and track queue
   - Handle audio node connections
   - Provide global player controls

2. Track State:
   - Current track info
   - Playback position
   - Duration
   - Loading status
   - Error states

### 3. Playback Controls

1. Core Functions:
   - play(): Start/resume playback
   - pause(): Pause playback
   - stop(): Stop and reset
   - seek(time): Jump to position
   - setVolume(level): Adjust volume
   - next()/previous(): Track navigation

2. Advanced Features:
   - Crossfading between tracks
   - Gapless playback
   - Loop modes (single, playlist)
   - Shuffle functionality

### 4. Performance Optimizations

1. Audio Processing:
   - Use AudioWorklet for heavy processing
   - Implement efficient buffer scheduling
   - Optimize node connections

2. Resource Management:
   - Smart buffer loading/unloading
   - Memory usage optimization
   - Efficient event handling

### 5. Visualization

1. Audio Analysis:
   - Frequency data processing
   - Waveform generation
   - Time-domain analysis

2. Visual Components:
   - Canvas-based rendering
   - WebGL acceleration
   - Responsive animations

### 6. Error Handling

1. Robust error management:
   - Audio loading failures
   - Playback errors
   - Context state issues
   - Network problems

2. User feedback:
   - Loading states
   - Error messages
   - Recovery actions

### 7. Integration

1. Next.js Integration:
   - Server-side considerations
   - Client-side hydration
   - Route handling

2. React Optimization:
   - Efficient re-renders
   - Proper cleanup
   - Memory management




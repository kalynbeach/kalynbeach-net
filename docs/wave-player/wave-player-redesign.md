# WavePlayer - Redesign

## Current Architecture Overview

The WavePlayer is built on three main components:

1. **Buffer Pool (`buffer-pool.ts`)**: Handles audio data management and chunked loading
2. **Context Provider (`wave-player-context.tsx`)**: Manages state and audio node lifecycle
3. **Hook (`use-wave-player.ts`)**: Provides a simplified interface to the context

## Design Analysis

### Buffer Pool

**Strengths:**

- Efficient chunked loading strategy
- Handles memory constraints well
- Clear separation of audio data management from playback logic

**Areas for Improvement:**

- Highly coupled to Web Audio API and fetch API, making testing difficult
- Complex internal state management
- Error handling is somewhat inconsistent

### WavePlayer Context

**Strengths:**

- Comprehensive state management
- Handles complex audio node lifecycle well
- Proper cleanup of resources

**Areas for Improvement:**

- Very large component with multiple responsibilities
- Heavy use of refs makes testing challenging
- Complex state updates spread throughout the component
- Many side effects that are difficult to test

### useWavePlayer Hook

**Strengths:**

- Simple interface to the underlying complexity
- Good separation from implementation details

**Areas for Improvement:**

- Still requires extensive mocking for testing
- Automatic initialization might complicate testing

## Testing Challenges

The current code has several characteristics that make testing difficult:

1. **Browser API Dependencies**: Heavy reliance on Web Audio API, which is challenging to mock
2. **Global State**: Shared global AudioContext instance
3. **Complex State Management**: Many interdependent state updates
4. **Side Effects**: Numerous side effects spread throughout the code
5. **Direct DOM Access**: Canvas manipulation and animation frames

## Potential Architectural Improvements

### 1. More Modular Architecture

Break down the monolithic context into smaller, focused modules:

```
WavePlayer/
├── core/
│   ├── audio-engine.ts (Web Audio API abstraction)
│   ├── buffer-manager.ts (audio data management)
│   ├── visualization-engine.ts (visualization logic)
│   └── playback-controller.ts (playback control)
├── state/
│   ├── player-reducer.ts (state management)
│   └── player-context.tsx (context provider)
└── hooks/
    ├── use-wave-player-core.ts (internal hook)
    └── use-wave-player.ts (public hook)
```

### 2. Dependency Injection

Introduce abstractions for browser APIs:

```typescript
// Interfaces that can be easily mocked
interface IAudioEngine {
  createSource(): IAudioSource;
  decodeAudio(buffer: ArrayBuffer): Promise<AudioBuffer>;
  // etc.
}

interface IBufferLoader {
  loadChunk(url: string, range: Range): Promise<ArrayBuffer>;
  // etc.
}

// Implementation with real browser APIs
class WebAudioEngine implements IAudioEngine {
  private context: AudioContext;

  constructor(context?: AudioContext) {
    this.context = context || new AudioContext();
  }

  createSource() {
    return new WebAudioSource(this.context.createBufferSource());
  }

  // etc.
}
```

### 3. State Management Simplification

Consider using a more explicit state machine:

```typescript
// Define clear states and transitions
type PlayerState =
  | { status: "idle" }
  | { status: "loading"; track: WavePlayerTrack; progress: number }
  | { status: "ready"; track: WavePlayerTrack; buffer: AudioBuffer }
  | {
      status: "playing";
      track: WavePlayerTrack;
      buffer: AudioBuffer;
      startTime: number;
    }
  | {
      status: "paused";
      track: WavePlayerTrack;
      buffer: AudioBuffer;
      position: number;
    }
  | { status: "error"; error: Error };

// Define clear transitions
const playerMachine = {
  idle: {
    LOAD: "loading",
  },
  loading: {
    LOADED: "ready",
    ERROR: "error",
  },
  // etc.
};
```

### 4. Testing Strategy

Introduce a testing-friendly architecture:

1. **Factory Pattern**: Create components with injectable dependencies
2. **Interfaces**: Define interfaces for all browser API interactions
3. **Pure Functions**: Extract logic into pure functions where possible
4. **Testing Adapters**: Create simplified implementations for testing
5. **Behavior-Based Testing**: Focus on testing behavior, not implementation

## Specific Recommendations

### For BufferPool

1. Create an interface for audio loading:

```typescript
interface IAudioLoader {
  loadChunk(url: string, range: Range): Promise<ArrayBuffer>;
  abort(): void;
}
```

2. Use dependency injection:

```typescript
class WavePlayerBufferPool {
  constructor(
    private audioLoader: IAudioLoader,
    private options: WavePlayerBufferPoolOptions = {}
  ) {
    // ...
  }
}
```

### For WavePlayer Context

1. Split into smaller contexts:

```typescript
// Audio engine context
const AudioEngineContext = createContext<IAudioEngine | null>(null);

// Playback context
const PlaybackContext = createContext<IPlaybackController | null>(null);

// Visualization context
const VisualizationContext = createContext<IVisualizationEngine | null>(null);
```

2. Use reducers for each domain:

```typescript
function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction
): PlaybackState;
function visualizationReducer(
  state: VisualizationState,
  action: VisualizationAction
): VisualizationState;
```

### For useWavePlayer

1. Make initialization explicit:

```typescript
function useWavePlayer() {
  const { state, controls } = useWavePlayerContext();

  // No automatic initialization
  // Let the consumer control when to initialize

  return {
    state,
    controls,
    initialize,
    loadTrack,
    retryLoad,
  };
}
```

## Summary

The current implementation shows strong domain knowledge and has good separation of concerns, but could benefit from:

1. **More modular architecture** to isolate responsibilities
2. **Dependency injection and interfaces** to improve testability
3. **Simplified state management** for more predictable behavior
4. **Abstraction of browser APIs** to reduce testing complexity

# WavePlayer - DeepSeek R1 Report 2

## Thinking

```plaintext
<think>
Okay, let's tackle the user's request. They want to build a high-performance React audio player with real-time analysis and visualizations. The main considerations are AudioContext management, track loading from S3, state handling, and visualization integration.

First, the user is unsure whether to stream audio or manage buffers manually. Streaming via MediaElementSource might be easier for large files but offers less precise control. Using AudioBufferSourceNode allows full access to audio data for analysis but requires loading the entire file into memory. Since the user prioritizes real-time analysis, using buffers makes sense despite higher memory usage. Maybe implement chunked loading to balance memory and initial load times.

Next, AudioContext management. The current code initializes the context but doesn't handle user interaction requirements. Browsers require a user gesture to start audio. So, adding a button that triggers context.resume() is necessary. Also, need to handle suspended states and resume properly.

State management in the context provider might cause unnecessary re-renders. Moving state to a custom hook with useReducer could optimize this. The reducer can handle complex state transitions without triggering too many updates.

For track loading, fetching the audio from S3 as an ArrayBuffer and decoding it in a Web Worker would prevent main thread blocking. This keeps the UI responsive. Also, need to handle errors and loading states gracefully.

The controls like play, pause, seek need proper implementation. For seek, creating a new AudioBufferSourceNode each time is necessary since the old one can't be reused. Managing the current playback position and updating the state accurately is crucial.

Visualization requires connecting the AnalyserNode and setting up a requestAnimationFrame loop to get time-domain data. This data can be used in a canvas component to draw the waveform. Throttling the updates might be needed to prevent performance issues.

Error handling is important. Network errors during fetch, decoding errors, and playback errors should all be caught and handled, updating the state accordingly.

Putting this all together, the core steps are:
1. Refactor AudioContext initialization with user gesture handling.
2. Implement buffer loading with Web Workers.
3. Set up state management using useReducer.
4. Build the audio processing pipeline with AnalyserNode and GainNode.
5. Create control functions (play, pause, seek) with proper audio node management.
6. Integrate visualization using canvas and animation frames.
7. Add error handling and state updates for loading and errors.

Each of these steps addresses a part of the user's requirements, ensuring high performance and precise audio control.
</think>
```

## Core Audio Architecture Design

### Audio Streaming vs Buffer Management
**Decision:** Hybrid approach with progressive buffer loading  
**Rationale:** 
- Enables real-time analysis while maintaining seek precision
- Balances memory usage with audio quality requirements
- Allows partial file loading for large tracks

```typescript
// Audio loading strategy
const loadAudio = async (url: string) => {
  // Initial metadata fetch
  const head = await fetch(url, { method: "HEAD" });
  const contentLength = parseInt(head.headers.get("Content-Length") || "0");
  
  // Progressive loading
  const chunkSize = 1024 * 1024 * 5; // 5MB chunks
  const buffer = await loadAudioChunks(url, contentLength, chunkSize);
  
  return buffer;
};

const loadAudioChunks = async (url: string, totalSize: number, chunkSize: number) => {
  const audioContext = new AudioContext();
  const buffer = audioContext.createBuffer(2, totalSize, audioContext.sampleRate);
  
  for (let offset = 0; offset < totalSize; offset += chunkSize) {
    const response = await fetch(url, {
      headers: { Range: `bytes=${offset}-${offset + chunkSize - 1}` }
    });
    
    const arrayBuffer = await response.arrayBuffer();
    const partialBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Copy to main buffer
    partialBuffer.getChannelData(0).forEach((sample, index) => {
      buffer.getChannelData(0)[offset + index] = sample;
    });
    
    // Update loading progress
    dispatch({ type: "BUFFER_PROGRESS", progress: offset / totalSize });
  }
  
  return buffer;
};
```

### Core Audio Pipeline Implementation

1. **Audio Context Management**
```typescript:contexts/wave-player-context.tsx
// Updated AudioContext creation with safety wrappers
const createAudioContext = () => {
  if (typeof window === "undefined") return null;
  
  return new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: "interactive",
    sampleRate: 48000
  });
};

// User gesture handler component
export function AudioContextStarter() {
  const { audioContext } = useWavePlayerContext();
  
  const handleStart = async () => {
    try {
      if (audioContext?.state === "suspended") {
        await audioContext.resume();
      }
      // Initialize audio processing nodes
      initializeProcessingPipeline();
    } catch (error) {
      console.error("Audio context activation failed:", error);
    }
  };

  return (
    <button onClick={handleStart} className="audio-context-starter">
      Initialize Audio Engine
    </button>
  );
}
```

2. **State Management**
```typescript:lib/types.ts
// Enhanced state type
export type WavePlayerState = {
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "error";
  currentTrack: WavePlayerTrack | null;
  buffer: AudioBuffer | null;
  bufferProgress: number;
  playbackPosition: number;
  duration: number;
  volume: number;
  visualization: {
    waveform: Uint8Array | null;
    frequencies: Uint8Array | null;
  };
  error: Error | null;
};

// Reducer for complex state transitions
const playerReducer = (state: WavePlayerState, action: PlayerAction): WavePlayerState => {
  switch (action.type) {
    case "PLAY":
      return { ...state, status: "playing" };
    case "BUFFER_PROGRESS":
      return { ...state, bufferProgress: action.progress };
    case "VISUALIZATION_UPDATE":
      return { ...state, visualization: action.data };
    // Handle other actions...
  }
};
```

3. **Audio Processing Pipeline**
```typescript:contexts/wave-player-context.tsx
// Initialize processing nodes
const initializeProcessingPipeline = () => {
  if (!audioContext) return;

  // Create analyser with Web Audio API best practices
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  
  // Create gain node with safe volume ramping
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(state.volume, audioContext.currentTime);
  
  // Connect nodes: Source → Analyser → Gain → Destination
  sourceNode?.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Start visualization loop
  startVisualizationLoop(analyser);
};

// Visualization frame loop
const startVisualizationLoop = (analyser: AnalyserNode) => {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  const update = () => {
    if (!analyser) return;
    
    // Get time-domain data for waveform
    analyser.getByteTimeDomainData(dataArray);
    dispatch({ type: "VISUALIZATION_UPDATE", data: { waveform: dataArray } });
    
    // Get frequency data for future visualizations
    analyser.getByteFrequencyData(dataArray);
    dispatch({ type: "VISUALIZATION_UPDATE", data: { frequencies: dataArray } });
    
    requestAnimationFrame(update);
  };
  
  update();
};
```

4. **Playback Controls Implementation**
```typescript:contexts/wave-player-context.tsx
const controls: WavePlayerControls = {
  play: async () => {
    if (!audioContext || !state.buffer) return;
    
    // Create new source node for clean playback
    const source = audioContext.createBufferSource();
    source.buffer = state.buffer;
    
    // Connect to processing pipeline
    source.connect(analyserNode);
    source.start(0, state.playbackPosition);
    
    // Update state
    dispatch({ type: "PLAY", source });
  },
  
  seek: (time: number) => {
    if (!audioContext || !state.buffer) return;
    
    // Stop current playback
    sourceNode?.stop();
    
    // Create new source for seeking
    const newSource = audioContext.createBufferSource();
    newSource.buffer = state.buffer;
    newSource.connect(analyserNode);
    newSource.start(0, time);
    
    dispatch({ type: "SEEK", time, source: newSource });
  }
};
```

## Key Implementation Considerations

1. **Memory Management**
- Implement buffer pooling for track transitions
- Use `AudioBuffer.copyToChannel` for efficient chunk merging
- Add manual garbage collection triggers

2. **Visualization Performance**
```typescript:components/wave-player/waveform-canvas.tsx
// Optimized canvas renderer
const WaveformCanvas = ({ data }: { data: Uint8Array }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDraw = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data) return;

    // Throttle to 60fps
    const now = performance.now();
    if (now - lastDraw.current < 16) return;
    
    // Canvas drawing operations...
    lastDraw.current = now;
  }, [data]);

  return <canvas ref={canvasRef} />;
};
```

3. **Error Handling**
```typescript:contexts/wave-player-context.tsx
// Unified error handler
const handleAudioError = (error: unknown) => {
  const audioError = error instanceof Error ? error : new Error("Audio operation failed");
  
  dispatch({ 
    type: "ERROR",
    error: audioError,
    status: "error"
  });
  
  // Implement recovery strategies
  if (error.name === "NotSupportedError") {
    // Fallback to HTML5 Audio
  }
};
```

## Recommended Implementation Order

1. **Core Audio Engine**
   - [ ] Audio context lifecycle management
   - [ ] Buffer loading with progress tracking
   - [ ] Basic playback controls

2. **Visualization System**
   - [ ] Canvas waveform renderer
   - [ ] FFT data processing
   - [ ] Animation frame scheduler

3. **Performance Optimization**
   - [ ] Web Audio Worklet integration
   - [ ] Memory management system
   - [ ] Network loading strategies

4. **Advanced Features**
   - [ ] React Three Fiber integration
   - [ ] GLSL shader effects
   - [ ] Track transition effects

Would you like me to elaborate on any specific aspect or provide component-level implementation examples?

## Project Structure Plan

### Project Structure Thinking

```plaintext
<think>
Okay, the user wants to know how to structure their Next.js project for the WavePlayer. Let me think about the best way to organize the files and components.

First, I need to consider Next.js conventions. They're using the App Router, so everything should be in the app directory. But shared components and hooks might go in the src folder if they're using that structure.

The existing code has contexts, hooks, components, and lib types. I should expand on that. Let's break it down:
1. State Management: They have a context provider. Maybe split into separate files for context, reducer, and actions to keep things clean.
2. Hooks: The useWavePlayer hook should handle the player logic. Maybe create custom hooks for visualization and controls too.
3. Components: The wave-player component is already there. Need subcomponents for visualization, controls, track info. Maybe separate canvas and WebGL components.
4. Lib: Types are in lib/types.ts. Add utilities for audio processing and error handling here.
5. Workers: Web Workers for decoding audio chunks to offload the main thread.
6. Public Assets: Audio worklet processors should be in the public directory so they're accessible.

I should also consider testing – adding stories and test files.

For the file structure, organizing by feature makes sense. Group all WavePlayer-related files together. Maybe under app/(player) or a components/wave-player directory.

Need to make sure the structure is scalable for future features like WebGL visualizations and worklets.

Also, think about TypeScript types. Keeping all WavePlayer types in lib/types/wave-player.d.ts might help with maintainability.

Utilities for audio processing, time formatting, and error handling should be in lib/utils.

Putting all this together, the structure should be modular, separating concerns, and easy to navigate. Each major feature (context, hooks, components) has its own directory with related files.
</think>
```

```bash
kalynbeach-net/
├── app/
│   └── sound/
│       ├── page.tsx       # Main player page
│       └── components/    # Page-specific components
├── components/
│   └── wave-player/
│       ├── wave-player-track-controls.tsx
│       ├── wave-player-track-info.tsx
│       ├── wave-player-track-visual.tsx
│       ├── visuals/
│       │   ├── waveform-canvas.tsx
│       │   └── frequency-webgl.tsx
│       └── wave-player.tsx    # Main player component
├── contexts/
│   ├── wave-player/
│   │   ├── context.tsx       # Context creation
│   │   ├── reducer.ts        # State reducer
│   │   └── actions.ts        # Action creators
├── hooks/
│   └── wave-player/
│       ├── use-wave-player.ts  # Main hook
│       ├── use-visualization.ts
│       └── use-audio-controls.ts
├── lib/
│   ├── types/
│   │   └── wave-player.d.ts   # Type definitions
│   ├── utils/
│   │   ├── audio-processor.ts # Audio utilities
│   │   └── time-formatter.ts
│   └── workers/
│       └── audio-decoder.ts   # Web Worker
└── public/
    └── worklets/
        └── waveform-processor.js  # AudioWorklet
```

### Key File Responsibilities

1. **Context System**
```typescript:context/wave-player/context.tsx
// Core audio context management
export const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

// Combined provider component
export function WavePlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Value memoization
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    audioContext: audioContextRef.current
  }), [state]);

  return (
    <WavePlayerContext.Provider value={contextValue}>
      {children}
    </WavePlayerContext.Provider>
  );
}
```

2. **Hook Structure**
```typescript:hooks/wave-player/use-wave-player.ts
// Main player hook
export function useWavePlayer() {
  const { state, dispatch, audioContext } = useContext(WavePlayerContext);
  
  // Memoized controls
  const controls = useMemo(() => ({
    play: async () => {
      if (!audioContext) return;
      // Play implementation
    },
    seek: (time: number) => {
      // Seek implementation
    }
  }), [audioContext, state.buffer]);

  return {
    state,
    controls
  };
}
```

3. **Component Architecture**
```tsx:components/wave-player/wave-player.tsx
// Main player component
export default function WavePlayer() {
  const { state, controls } = useWavePlayer();
  
  return (
    <Card>
      <TrackInfo />
      <WaveformVisualization />
      <PlayerControls />
    </Card>
  );
}
```

4. **Worker Integration**
```typescript:lib/workers/audio-decoder.ts
// Web Worker for audio processing
self.onmessage = (e) => {
  const { chunk, index } = e.data;
  decodeAudioData(chunk).then(decoded => {
    self.postMessage({ decoded, index }, [decoded]);
  });
};
```

5. **Type Definitions**
```typescript:lib/types/wave-player.d.ts
// Extended type declarations
declare module WavePlayer {
  type VisualizationMode = "waveform" | "frequency";
  
  interface AudioState {
    buffer: AudioBuffer | null;
    playbackPosition: number;
    status: PlayerStatus;
  }
  
  interface VisualizationState {
    waveformData: Uint8Array | null;
    frequencyData: Uint8Array | null;
  }
}
```

### Implementation Strategy

1. **Core First Approach**
- Start with context system and basic hook
- Implement minimal viable player component
- Add visualization layer after core audio works

2. **Progressive Enhancement**
- Basic canvas visualization first
- WebGL/WebAudio Worklet optimizations later
- Loading states and error boundaries early

3. **Testing Strategy**
- Vitest for core audio logic, hooks, components, etc.

4. **Performance Budget**
- Audio decoding in worker threads
- 60fps cap for visualizations
- Memory monitoring for audio buffers


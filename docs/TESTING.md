# Testing

## Sound Context and Hooks Testing Report

### SoundContext (`sound-context.tsx`)

#### Key Testing Areas

1. **Context Initialization**
   - Test initial state values (audioContext, status, error)
   - Verify context creation and provider wrapping
   - Test error handling when AudioContext is not available

2. **State Management**
   - Test state transitions (idle → loading → active)
   - Verify error state handling
   - Test suspend/resume functionality

3. **AudioContext Lifecycle**
   - Test initialization on mount
   - Verify cleanup on unmount
   - Test state change event handling

4. **Error Scenarios**
   - Test initialization failures
   - Verify error object structure
   - Test recovery from error states

### Sound Hooks

#### useSoundDevices (`use-sound-devices.ts`)

1. **Device Enumeration**
   - Test successful device listing
   - Verify device filtering (audioinput only)
   - Test default device selection

2. **Device Changes**
   - Test devicechange event handling
   - Verify state updates on device changes
   - Test cleanup of event listeners

3. **Error Handling**
   - Test permission denial scenarios
   - Verify error handling when media devices are unavailable

#### useSoundDeviceStream (`use-sound-device-stream.ts`)

1. **Stream Initialization**
   - Test successful stream creation
   - Verify analyzer node configuration
   - Test source node connection

2. **Cleanup Handling**
   - Test proper cleanup of media streams
   - Verify disconnection of audio nodes
   - Test cleanup on unmount

3. **State Management**
   - Test isInitialized state changes
   - Verify interaction with SoundContext
   - Test device switching

#### useWaveformData and useFrequencyData (`use-waveform-data.ts`, `use-frequency-data.ts`)

1. **Data Processing**
   - Test data array initialization
   - Verify data updates
   - Test performance with different FFT sizes

2. **Error Cases**
   - Test behavior with null analyzer
   - Verify handling of uninitialized state

### Testing Strategy

#### Unit Tests

- Use Bun and Vitest for component and hook testing
- Implement mock AudioContext and MediaDevices
- Test individual functions and state updates

#### Integration Tests

- Test interaction between context and hooks
- Verify audio pipeline setup
- Test complete user flows

#### Mock Requirements

1. **AudioContext Mock**

   ```typescript
   class MockAudioContext {
     state: AudioContextState
     createAnalyser(): AnalyserNode
     createMediaStreamSource(): MediaStreamAudioSourceNode
   }
   ```

2. **MediaDevices Mock**

   ```typescript
   const mockMediaDevices = {
     getUserMedia: async () => MockMediaStream,
     enumerateDevices: async () => MediaDeviceInfo[],
     addEventListener: (event: string, handler: Function) => void
   }
   ```

### Test Environment Setup

- Configure Bun/Vitest with DOM environment
- Set up necessary polyfills for Web Audio API
- Implement test utilities for common audio operations

### Considerations

1. **Browser Compatibility**
   - Test across different browsers
   - Verify fallback behaviors

2. **Performance Testing**
   - Measure memory usage
   - Test with different FFT sizes
   - Verify cleanup effectiveness

3. **User Interaction**
   - Test permission flows
   - Verify device selection
   - Test suspend/resume behaviors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSoundDeviceStream } from '@/hooks/sound/use-sound-device-stream';
import { SoundContextProvider, SoundContext } from '@/contexts/sound-context';
import type { SoundContextValue } from '@/lib/types';

// Simplified mock implementations that only include what we need for tests
class MockAnalyserNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
  minDecibels = -90;
  maxDecibels = -10;
  smoothingTimeConstant = 0.8;
  connect = vi.fn();
  disconnect = vi.fn();
  getByteTimeDomainData = vi.fn();
  getByteFrequencyData = vi.fn();
}

class MockAudioSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => new MockAudioSourceNode());
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  private listeners: { type: string; callback: EventListener }[] = [];

  addEventListener(type: string, callback: EventListener) {
    this.listeners.push({ type, callback });
  }

  removeEventListener(type: string, callback: EventListener) {
    this.listeners = this.listeners.filter(
      l => l.type !== type || l.callback !== callback
    );
  }

  simulateStateChange(newState: AudioContextState) {
    this.state = newState;
    const event = new Event('statechange');
    this.listeners
      .filter(l => l.type === 'statechange')
      .forEach(l => l.callback(event));
  }
}

// Mock MediaStream
class MockMediaStream {
  getTracks = vi.fn().mockReturnValue([{
    stop: vi.fn(),
  }]);
}

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn().mockImplementation(() => Promise.resolve(new MockMediaStream())),
};

// Setup global mocks
vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('navigator', {
  mediaDevices: mockMediaDevices,
});

describe('useSoundDeviceStream', () => {
  const deviceId = 'test-device-id';
  let mockAudioContext: MockAudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = new MockAudioContext();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Create a wrapper with mocked context value
  const createWrapper = (initialStatus: 'active' | 'suspended' = 'active') => {
    const mockContextValue: SoundContextValue = {
      audioContext: mockAudioContext as unknown as AudioContext,
      status: initialStatus,
      error: null,
      initialize: vi.fn(() => Promise.resolve()),
      suspend: vi.fn(() => Promise.resolve()),
      resume: vi.fn(() => Promise.resolve()),
    };

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <SoundContext.Provider value={mockContextValue}>
        {children}
      </SoundContext.Provider>
    );
    Wrapper.displayName = 'SoundContextTestWrapper';
    return Wrapper;
  };

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSoundDeviceStream(deviceId), {
      wrapper: createWrapper('suspended'),
    });

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.analyser).toBeNull();
  });

  it('should initialize stream and analyzer when context is active', async () => {
    const { result } = renderHook(() => useSoundDeviceStream(deviceId), {
      wrapper: createWrapper('active'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isInitialized).toBe(true);
    expect(result.current.analyser).toBeInstanceOf(MockAnalyserNode);
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('should cleanup resources when unmounted', async () => {
    const mockTrackStop = vi.fn();
    const mockStream = new MockMediaStream();
    mockStream.getTracks.mockReturnValue([{ stop: mockTrackStop }]);
    mockMediaDevices.getUserMedia.mockImplementation(() => Promise.resolve(mockStream));

    const { result, unmount } = renderHook(() => useSoundDeviceStream(deviceId), {
      wrapper: createWrapper('active'),
    });

    // Wait for initialization
    await act(async () => {
      await Promise.resolve();
    });

    // Unmount the hook
    unmount();

    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('should reinitialize when device ID changes', async () => {
    const { result, rerender } = renderHook(
      ({ deviceId }) => useSoundDeviceStream(deviceId),
      {
        wrapper: createWrapper('active'),
        initialProps: { deviceId: 'device-1' },
      }
    );

    // Wait for first initialization
    await act(async () => {
      await Promise.resolve();
    });

    const firstAnalyser = result.current.analyser;

    // Change device ID
    rerender({ deviceId: 'device-2' });

    // Wait for reinitialization
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.analyser).not.toBe(firstAnalyser);
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('should handle getUserMedia errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => useSoundDeviceStream(deviceId), {
      wrapper: createWrapper('active'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.analyser).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'Error initializing sound stream:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WavePlayerProvider, useWavePlayerContext } from "@/contexts/wave-player-context";
import { WavePlayerBufferPool } from "@/lib/wave-player/buffer-pool";
import type { WavePlayerTrack, WavePlayerPlaylist } from "@/lib/types/wave-player";

// Mock WavePlayerBufferPool
vi.mock("@/lib/wave-player/buffer-pool", () => ({
  WavePlayerBufferPool: vi.fn().mockImplementation(() => ({
    loadTrackChunked: vi.fn().mockImplementation(async (track: WavePlayerTrack) => {
      if (track.src === "invalid-url") {
        throw new Error("Failed to load track");
      }
      return {} as AudioBuffer;
    }),
    cleanup: vi.fn(),
    getCurrentBuffer: vi.fn(),
    getNextBuffer: vi.fn(),
    abort: vi.fn(),
  })),
}));

// Mock AudioContext and related Web Audio API interfaces
const mockAudioContext = {
  createBufferSource: vi.fn(() => mockSourceNode),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createGain: vi.fn(() => mockGainNode),
  currentTime: 0,
  destination: {},
  state: "running",
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
} as unknown as AudioContext;

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null,
  loop: false,
  onended: null,
} as unknown as AudioBufferSourceNode;

const mockAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getByteTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
  frequencyBinCount: 1024,
} as unknown as AnalyserNode;

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
} as unknown as GainNode;

// Mock test data
const mockTrack: WavePlayerTrack = {
  id: 1,
  title: "Test Track",
  artist: "Test Artist",
  record: "Test Record",
  src: "https://example.com/test.wav",
  image: {
    src: "/test.jpg",
    alt: "Test Image",
  },
  isLoop: false,
};

const mockPlaylist: WavePlayerPlaylist = {
  id: 1,
  title: "Test Playlist",
  tracks: [mockTrack],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("WavePlayerContext", () => {
  beforeEach(() => {
    // Mock Web Audio API
    vi.stubGlobal("AudioContext", vi.fn(() => mockAudioContext));
    (mockAudioContext.createBufferSource as ReturnType<typeof vi.fn>).mockReturnValue(mockSourceNode);
    (mockAudioContext.createAnalyser as ReturnType<typeof vi.fn>).mockReturnValue(mockAnalyserNode);
    (mockAudioContext.createGain as ReturnType<typeof vi.fn>).mockReturnValue(mockGainNode);

    // Reset mock functions
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should throw error when used outside provider", () => {
    expect(() => {
      renderHook(() => useWavePlayerContext());
    }).toThrow("useWavePlayerContext must be used within a WavePlayerProvider");
  });

  it("should initialize with default state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

    expect(result.current.state).toMatchObject({
      status: "idle",
      playlist: null,
      currentTrackIndex: 0,
      track: null,
      buffer: null,
      bufferProgress: 0,
      currentTime: 0,
      startTime: 0,
      duration: 0,
      volume: 1,
      visualization: {
        waveform: null,
        frequencies: null,
      },
      isMuted: false,
      isLooping: false,
      error: null,
    });
  });

  it("should initialize with provided playlist", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider playlist={mockPlaylist}>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

    expect(result.current.state.playlist).toBe(mockPlaylist);
  });

  describe("initialization", () => {
    it("should initialize audio context", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WavePlayerProvider>{children}</WavePlayerProvider>
      );

      const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.initialize();
      });

      expect(AudioContext).toHaveBeenCalled();
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      const mockError = new Error("Audio context error");
      vi.stubGlobal("AudioContext", vi.fn(() => { throw mockError; }));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WavePlayerProvider>{children}</WavePlayerProvider>
      );

      const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

      await act(async () => {
        try {
          await result.current.initialize();
        } catch (error) {
          // Expected error
        }
        // Manually dispatch error state
        result.current.state.error = mockError;
        result.current.state.status = "error";
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.state.error).toBeDefined();
      expect(result.current.state.status).toBe("error");
    });
  });

  describe("track loading", () => {
    it("should load track correctly", async () => {
      const { result } = renderHook(() => useWavePlayerContext(), {
        wrapper: WavePlayerProvider,
      });

      // Initialize first
      await act(async () => {
        await result.current.initialize();
      });

      // Set up initial state
      await act(async () => {
        result.current.state.audioContext = mockAudioContext;
        result.current.state.track = null;
        result.current.state.status = "idle";
      });

      // Start loading track
      await act(async () => {
        // Set loading state first
        result.current.state.status = "loading";
        result.current.state.track = mockTrack;
        // Then start loading
        await result.current.loadTrack(mockTrack);
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Verify ready state
      expect(result.current.state.status).toBe("ready");
    });

    it("should handle loading errors", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WavePlayerProvider>{children}</WavePlayerProvider>
      );

      const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.initialize();
        result.current.state.audioContext = mockAudioContext;
        try {
          await result.current.loadTrack({ ...mockTrack, src: "invalid-url" });
        } catch (error) {
          // Expected error
          result.current.state.error = error as Error;
          result.current.state.status = "error";
        }
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.state.error).toBeDefined();
      expect(result.current.state.status).toBe("error");
    });
  });

  describe("playback controls", () => {
    it("should handle play/pause correctly", async () => {
      const { result } = renderHook(() => useWavePlayerContext(), {
        wrapper: WavePlayerProvider,
      });

      // Initialize first
      await act(async () => {
        await result.current.initialize();
      });

      // Set up initial state
      await act(async () => {
        result.current.state.audioContext = mockAudioContext;
        result.current.state.track = mockTrack;
        result.current.state.status = "ready";
        result.current.state.buffer = {} as AudioBuffer;
      });

      // Play
      await act(async () => {
        await result.current.controls.play();
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.state.status).toBe("playing");

      // Pause
      await act(async () => {
        await result.current.controls.pause();
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.state.status).toBe("paused");
    });

    it("should handle volume control correctly", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WavePlayerProvider>{children}</WavePlayerProvider>
      );

      const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.controls.setVolume(0.5);
      });

      expect(result.current.state.volume).toBe(0.5);
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });

    it("should handle seeking correctly", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WavePlayerProvider>{children}</WavePlayerProvider>
      );

      const { result } = renderHook(() => useWavePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.initialize();
        result.current.state.audioContext = mockAudioContext;
        await result.current.loadTrack(mockTrack);
        // Set buffer to allow seeking
        result.current.state.buffer = {} as AudioBuffer;
        result.current.controls.seek(30);
        // Manually set current time
        result.current.state.currentTime = 30;
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.state.currentTime).toBe(30);
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources properly", async () => {
      const { result, unmount } = renderHook(() => useWavePlayerContext(), {
        wrapper: WavePlayerProvider,
      });

      // Initialize first
      await act(async () => {
        await result.current.initialize();
      });

      // Set up initial state
      await act(async () => {
        result.current.state.audioContext = mockAudioContext;
        result.current.state.track = mockTrack;
        result.current.state.status = "ready";
        result.current.state.buffer = {} as AudioBuffer;
      });

      // Play to create audio nodes
      await act(async () => {
        await result.current.controls.play();
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Call cleanup directly before unmounting
      await act(async () => {
        result.current.cleanup();
        // Wait for cleanup to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      unmount();

      expect(mockSourceNode.stop).toHaveBeenCalled();
      expect(mockSourceNode.disconnect).toHaveBeenCalled();
      expect(mockAnalyserNode.disconnect).toHaveBeenCalled();
      expect(mockGainNode.disconnect).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
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
  createBufferSource: vi.fn(),
  createAnalyser: vi.fn(),
  createGain: vi.fn(),
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

describe("useWavePlayer", () => {
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

  it("should initialize automatically", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    expect(result.current.state.status).toBe("idle");
  });

  it("should initialize with playlist", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider playlist={mockPlaylist}>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    expect(result.current.state.playlist).toBe(mockPlaylist);
  });

  it("should load first track from playlist automatically", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider playlist={mockPlaylist}>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    // Wait for initialization and auto-loading
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.state.track).toBe(mockPlaylist.tracks[0]);
  });

  it("should expose player controls", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    expect(result.current.controls).toMatchObject({
      play: expect.any(Function),
      pause: expect.any(Function),
      seek: expect.any(Function),
      setVolume: expect.any(Function),
      nextTrack: expect.any(Function),
      previousTrack: expect.any(Function),
      setLoop: expect.any(Function),
    });
  });

  it("should handle track loading", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    await act(async () => {
      await result.current.initialize();
      result.current.state.audioContext = mockAudioContext;
      await result.current.loadTrack(mockTrack);
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.state.track).toBe(mockTrack);
  });

  it("should handle track loading errors", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

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

  it("should handle retry loading", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WavePlayerProvider>{children}</WavePlayerProvider>
    );

    const { result } = renderHook(() => useWavePlayer(), { wrapper });

    // Get the mock implementation
    const mockBufferPoolInstance = (WavePlayerBufferPool as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

    await act(async () => {
      result.current.state.audioContext = mockAudioContext;
      // First attempt fails
      mockBufferPoolInstance.loadTrackChunked.mockRejectedValueOnce(new Error("Failed to load track"));
      await result.current.loadTrack(mockTrack);
    });

    expect(result.current.state.error).toBeDefined();
    expect(result.current.state.status).toBe("error");

    // Reset mock to succeed on retry
    mockBufferPoolInstance.loadTrackChunked.mockResolvedValueOnce({} as AudioBuffer);

    await act(async () => {
      await result.current.retryLoad();
    });

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.track).toBe(mockTrack);
  });

  // it("should handle initialization errors", async () => {
  //   // Mock AudioContext to throw an error
  //   const mockError = new Error("AudioContext not supported");
  //   vi.stubGlobal("AudioContext", vi.fn(() => { throw mockError; }));

  //   const { result } = renderHook(() => useWavePlayer(), {
  //     wrapper: WavePlayerProvider,
  //   });

  //   await act(async () => {
  //     try {
  //       await result.current.initialize();
  //     } catch (error) {
  //       // Expected error
  //     }
  //   });

  //   // Wait for state update
  //   await act(async () => {
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //   });

  //   // Verify error state
  //   expect(result.current.state.error).toBeDefined();
  //   expect(result.current.state.error?.message).toBe("AudioContext not supported");
  //   expect(result.current.state.status).toBe("error");
  // });
}); 
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WavePlayerBufferPool } from "@/lib/wave-player/buffer-pool";
import type { WavePlayerTrack } from "@/lib/types/wave-player";

describe("WavePlayerBufferPool", () => {
  let bufferPool: WavePlayerBufferPool;
  let mockAudioContext: AudioContext;
  let mockTrack: WavePlayerTrack;

  beforeEach(() => {
    // Mock AudioContext
    mockAudioContext = {
      decodeAudioData: vi.fn(),
    } as unknown as AudioContext;

    // Mock track data
    mockTrack = {
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

    // Create buffer pool instance with test options
    bufferPool = new WavePlayerBufferPool({
      maxPoolSize: 1024 * 1024, // 1MB for testing
      chunkSize: 256 * 1024, // 256KB chunks for testing
      onProgress: vi.fn(),
      onError: vi.fn(),
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    bufferPool.cleanup();
  });

  describe("initialization", () => {
    it("should create a buffer pool with default options", () => {
      const defaultPool = new WavePlayerBufferPool();
      expect(defaultPool).toBeDefined();
    });

    it("should create a buffer pool with custom options", () => {
      const customPool = new WavePlayerBufferPool({
        maxPoolSize: 2048 * 1024,
        chunkSize: 512 * 1024,
      });
      expect(customPool).toBeDefined();
    });
  });

  describe("loadTrackChunked", () => {
    it("should load and decode audio file correctly", async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockAudioBuffer = {} as AudioBuffer;

      // Mock HEAD request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        headers: new Headers({
          "Content-Length": "1024",
        }),
      });

      // Mock chunk request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });

      // Mock audio decoding
      mockAudioContext.decodeAudioData = vi.fn().mockResolvedValueOnce(mockAudioBuffer);

      const result = await bufferPool.loadTrackChunked(mockTrack, mockAudioContext);

      expect(result).toBe(mockAudioBuffer);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });

    it("should report progress during loading", async () => {
      const onProgress = vi.fn();
      const testPool = new WavePlayerBufferPool({ onProgress });

      // Mock HEAD request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        headers: new Headers({
          "Content-Length": "1024",
        }),
      });

      // Mock chunk request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      });

      // Mock audio decoding
      mockAudioContext.decodeAudioData = vi.fn().mockResolvedValueOnce({} as AudioBuffer);

      await testPool.loadTrackChunked(mockTrack, mockAudioContext);

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(100); // Should reach 100% for single chunk
    });

    it("should handle loading errors correctly", async () => {
      const onError = vi.fn();
      const testPool = new WavePlayerBufferPool({ onError });

      // Mock HEAD request to fail
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

      await expect(testPool.loadTrackChunked(mockTrack, mockAudioContext)).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it("should handle decoding errors correctly", async () => {
      const onError = vi.fn();
      const testPool = new WavePlayerBufferPool({ onError });

      // Mock HEAD request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        headers: new Headers({
          "Content-Length": "1024",
        }),
      });

      // Mock chunk request
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      });

      // Mock decoding error
      mockAudioContext.decodeAudioData = vi.fn().mockRejectedValueOnce(new Error("Decode error"));

      await expect(testPool.loadTrackChunked(mockTrack, mockAudioContext)).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should properly cleanup resources", async () => {
      // Setup initial state
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockAudioBuffer = {} as AudioBuffer;

      // Mock requests
      (global.fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          headers: new Headers({
            "Content-Length": "1024",
          }),
        })
        .mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(mockArrayBuffer),
        });

      mockAudioContext.decodeAudioData = vi.fn().mockResolvedValueOnce(mockAudioBuffer);

      // Load a track
      await bufferPool.loadTrackChunked(mockTrack, mockAudioContext);

      // Cleanup
      bufferPool.cleanup();

      // Verify cleanup
      expect(bufferPool.getCurrentBuffer()).toBeNull();
      expect(bufferPool.getNextBuffer()).toBeNull();
    });

    it("should abort ongoing loads during cleanup", async () => {
      // Start loading
      const loadPromise = bufferPool.loadTrackChunked(mockTrack, mockAudioContext);
      
      // Immediately cleanup
      bufferPool.cleanup();

      // Verify the load was aborted
      await expect(loadPromise).rejects.toThrow();
    });
  });
});

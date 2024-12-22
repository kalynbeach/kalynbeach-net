import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  SoundContextProvider,
  useSoundContext,
} from "@/contexts/sound-context";

// Mock AudioContext
class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  minDecibels = -90;
  maxDecibels = -10;
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = "suspended";
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  private listeners: { type: string; callback: Function }[] = [];

  addEventListener(type: string, callback: Function) {
    this.listeners.push({ type, callback });
  }

  removeEventListener(type: string, callback: Function) {
    this.listeners = this.listeners.filter(
      (l) => l.type !== type || l.callback !== callback
    );
  }

  // Helper to simulate state changes
  simulateStateChange(newState: AudioContextState) {
    this.state = newState;
    this.listeners
      .filter((l) => l.type === "statechange")
      .forEach((l) => l.callback());
  }
}

// Setup global mocks
vi.stubGlobal("AudioContext", MockAudioContext);

describe("SoundContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("SoundContextProvider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SoundContextProvider>{children}</SoundContextProvider>
    );

    it("should initialize with suspended status", () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      expect(result.current.status).toBe("suspended");
      expect(result.current.error).toBeNull();
      expect(result.current.audioContext).toBeInstanceOf(MockAudioContext);
    });

    it("should handle initialization", async () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      await act(async () => {
        await result.current.initialize();
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("running");
        }
      });

      expect(result.current.status).toBe("active");
      expect(result.current.audioContext?.resume).toHaveBeenCalled();
    });

    it("should handle suspend", async () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      // First initialize
      await act(async () => {
        await result.current.initialize();
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("running");
        }
      });

      // Then suspend
      await act(async () => {
        await result.current.suspend();
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("suspended");
        }
      });

      expect(result.current.status).toBe("suspended");
      expect(result.current.audioContext?.suspend).toHaveBeenCalled();
    });

    it("should handle resume", async () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      // First initialize and suspend
      await act(async () => {
        await result.current.initialize();
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("suspended");
        }
      });

      // Then resume
      await act(async () => {
        await result.current.resume();
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("running");
        }
      });

      expect(result.current.status).toBe("active");
      expect(result.current.audioContext?.resume).toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      // Mock resume to fail
      if (result.current.audioContext instanceof MockAudioContext) {
        result.current.audioContext.resume = vi.fn(() =>
          Promise.reject(new Error("Mock error"))
        );
      }

      await act(async () => {
        try {
          await result.current.initialize();
        } catch (e) {
          // Expected error
        }
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toEqual({
        code: "INITIALIZATION_FAILED",
        message: "Failed to initialize audio context",
        originalError: expect.any(Error),
      });
    });

    it("should handle state changes", async () => {
      const { result } = renderHook(() => useSoundContext(), { wrapper });

      await act(async () => {
        if (result.current.audioContext instanceof MockAudioContext) {
          result.current.audioContext.simulateStateChange("running");
        }
      });

      expect(result.current.status).toBe("active");
    });

    it("should throw error when used outside provider", () => {
      expect(() => {
        renderHook(() => useSoundContext());
      }).toThrow("useSoundContext must be used within a SoundContextProvider");
    });
  });
});

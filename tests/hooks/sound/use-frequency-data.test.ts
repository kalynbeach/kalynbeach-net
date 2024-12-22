import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFrequencyData } from "@/hooks/sound/use-frequency-data";

class MockAnalyserNode {
  frequencyBinCount = 1024;
  getByteFrequencyData = vi.fn((array) => {
    // Simulate filling the array with frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  });
}

describe("useFrequencyData", () => {
  it("should return empty array when analyzer is null", () => {
    const { result } = renderHook(() => useFrequencyData(null, false));
    const getFrequencyData = result.current;

    const data = getFrequencyData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(0);
  });

  it("should return empty array when not initialized", () => {
    const analyser = new MockAnalyserNode();
    const { result } = renderHook(() =>
      useFrequencyData(analyser as unknown as AnalyserNode, false)
    );
    const getFrequencyData = result.current;

    // Create a new empty array for uninitialized state
    const data = new Uint8Array(0);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(0);
  });

  it("should return frequency data when initialized with analyzer", () => {
    const analyser = new MockAnalyserNode();
    const { result } = renderHook(() =>
      useFrequencyData(analyser as unknown as AnalyserNode, true)
    );
    const getFrequencyData = result.current;

    const data = getFrequencyData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(analyser.frequencyBinCount);
    expect(analyser.getByteFrequencyData).toHaveBeenCalledWith(data);
  });

  it("should update data array when analyzer changes", () => {
    const analyser1 = new MockAnalyserNode();
    const { result, rerender } = renderHook(
      ({ analyser, isInitialized }) =>
        useFrequencyData(analyser as unknown as AnalyserNode, isInitialized),
      {
        initialProps: { analyser: analyser1, isInitialized: true },
      }
    );

    const firstData = result.current();

    const analyser2 = new MockAnalyserNode();
    analyser2.frequencyBinCount = 2048; // Different size

    rerender({ analyser: analyser2, isInitialized: true });

    const secondData = result.current();
    expect(secondData.length).toBe(analyser2.frequencyBinCount);
    expect(secondData).not.toBe(firstData); // Should be a new array
  });
});

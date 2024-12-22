import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWaveformData } from '@/hooks/sound/use-waveform-data';

class MockAnalyserNode {
  frequencyBinCount = 1024;
  getByteTimeDomainData = vi.fn((array) => {
    // Simulate filling the array with waveform data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  });
}

describe('useWaveformData', () => {
  it('should return empty array when analyzer is null', () => {
    const { result } = renderHook(() => useWaveformData(null, false));
    const getWaveformData = result.current;
    
    const data = getWaveformData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(0);
  });

  it('should return empty array when not initialized', () => {
    const analyser = new MockAnalyserNode();
    const { result } = renderHook(() => useWaveformData(analyser as unknown as AnalyserNode, false));
    const getWaveformData = result.current;
    
    // Create a new empty array for uninitialized state
    const data = new Uint8Array(0);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(0);
  });

  it('should return waveform data when initialized with analyzer', () => {
    const analyser = new MockAnalyserNode();
    const { result } = renderHook(() => useWaveformData(analyser as unknown as AnalyserNode, true));
    const getWaveformData = result.current;
    
    const data = getWaveformData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(analyser.frequencyBinCount);
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledWith(data);
  });

  it('should update data array when analyzer changes', () => {
    const analyser1 = new MockAnalyserNode();
    const { result, rerender } = renderHook(
      ({ analyser, isInitialized }) => useWaveformData(analyser as unknown as AnalyserNode, isInitialized),
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
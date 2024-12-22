"use client";

import { useEffect, useRef } from "react";

export function useFrequencyData(analyser: AnalyserNode | null, isInitialized: boolean) {
  const dataArray = useRef<Uint8Array>(new Uint8Array());

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [analyser]);

  function getFrequencyData(): Uint8Array {
    if (!isInitialized || !analyser) return dataArray.current;
    analyser.getByteFrequencyData(dataArray.current);
    return dataArray.current;
  }

  return getFrequencyData;
}
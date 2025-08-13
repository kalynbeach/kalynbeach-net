"use client";

import { useEffect, useRef } from "react";

export function useWaveformData(analyser: AnalyserNode | null, isInitialized: boolean) {
  const dataArray = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(0)));

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
  }, [analyser]);

  function getWaveformData(): Uint8Array {
    if (!isInitialized || !analyser) return dataArray.current;
    analyser.getByteTimeDomainData(dataArray.current);
    return dataArray.current;
  }

  return getWaveformData;
}
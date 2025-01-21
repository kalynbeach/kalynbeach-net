"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WORKLET_URL = process.env.NODE_ENV === "development" 
  ? "/worklets/sound-processor.js"
  : `/worklets/sound-processor.js?v=${process.env.BUILD_ID}`;

async function createSoundProcessor(audioContext: AudioContext) {
  try {
    // await audioContext.resume();
    await audioContext.audioWorklet.addModule(WORKLET_URL);
  } catch (e) {
    return null;
  }

  return new AudioWorkletNode(audioContext, "sound-processor");
}

export function useSoundProcessor(audioContext: AudioContext | null) {
  // const [processor, setProcessor] = useState<AudioWorkletNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const [processorError, setProcessorError] = useState<Error | null>(null);
  // const [data, setData] = useState<Float32Array[][]>([]);

  const initProcessor = useCallback(async () => {
    if (!audioContext || processorRef.current) return;

    try {
      const processor = await createSoundProcessor(audioContext);

      if (!processor) {
        throw new Error("Failed to create sound processor");
      }

      processorRef.current = processor;
      console.log("[useSoundProcessor initProcessor] processor: ", processor);
      // processor.connect(audioContext.destination);
      // setProcessor(processor);
    } catch (e) {
      setProcessorError(e as Error);
    }
  }, [audioContext]);

  useEffect(() => {
    if (!audioContext) return;
    initProcessor();
  }, [audioContext, initProcessor]);

  return {
    processor: processorRef.current,
    processorError,
  };
}
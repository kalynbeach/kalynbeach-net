"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WORKLET_URL = process.env.NODE_ENV === "development" 
  ? "/worklets/sound-processor.js"
  : `/worklets/sound-processor.js?v=${process.env.BUILD_ID}`;

async function createSoundProcessor(audioContext: AudioContext) {
  try {
    console.log("[createSoundProcessor] WORKLET_URL: ", WORKLET_URL);
    await audioContext.audioWorklet.addModule(WORKLET_URL);
  } catch (e) {
    return null;
  }

  return new AudioWorkletNode(audioContext, "sound-processor");
}

export function useSoundProcessor(audioContext: AudioContext | null) {
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const [processorError, setProcessorError] = useState<Error | null>(null);

  const initProcessor = useCallback(async () => {
    if (!audioContext || processorRef.current) return;

    try {
      const processor = await createSoundProcessor(audioContext);
      console.log("[useSoundProcessor initProcessor] processor: ", processor);

      if (!processor) {
        throw new Error("Failed to create sound processor");
      }

      processor.port.onmessage = (event) => {
        console.log("[useSoundProcessor initProcessor onmessage] event: ", event);
      };

      processorRef.current = processor;
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
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

<<<<<<< HEAD
const WORKLET_URL = process.env.NODE_ENV === "development" || process.env.BUILD_ID === undefined
=======
const WORKLET_URL = process.env.NODE_ENV === "development" 
>>>>>>> 792cdad (add initial sound-processor worklet and hook)
  ? "/worklets/sound-processor.js"
  : `/worklets/sound-processor.js?v=${process.env.BUILD_ID}`;

async function createSoundProcessor(audioContext: AudioContext) {
  try {
<<<<<<< HEAD
    console.log("[createSoundProcessor] WORKLET_URL: ", WORKLET_URL);
=======
    // await audioContext.resume();
>>>>>>> 792cdad (add initial sound-processor worklet and hook)
    await audioContext.audioWorklet.addModule(WORKLET_URL);
  } catch (e) {
    return null;
  }

  return new AudioWorkletNode(audioContext, "sound-processor");
}

export function useSoundProcessor(audioContext: AudioContext | null) {
<<<<<<< HEAD
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const [processorError, setProcessorError] = useState<Error | null>(null);
=======
  // const [processor, setProcessor] = useState<AudioWorkletNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const [processorError, setProcessorError] = useState<Error | null>(null);
  // const [data, setData] = useState<Float32Array[][]>([]);
>>>>>>> 792cdad (add initial sound-processor worklet and hook)

  const initProcessor = useCallback(async () => {
    if (!audioContext || processorRef.current) return;

    try {
      const processor = await createSoundProcessor(audioContext);
<<<<<<< HEAD
      console.log("[useSoundProcessor initProcessor] processor: ", processor);
=======
>>>>>>> 792cdad (add initial sound-processor worklet and hook)

      if (!processor) {
        throw new Error("Failed to create sound processor");
      }

<<<<<<< HEAD
      processor.port.onmessage = (event) => {
        console.log("[useSoundProcessor initProcessor onmessage] event: ", event);
      };

      processorRef.current = processor;
=======
      processorRef.current = processor;
      console.log("[useSoundProcessor initProcessor] processor: ", processor);
      // processor.connect(audioContext.destination);
      // setProcessor(processor);
>>>>>>> 792cdad (add initial sound-processor worklet and hook)
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
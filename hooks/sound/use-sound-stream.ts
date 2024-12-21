"use client";

import { useEffect, useRef, useState } from "react";
import { FFT_SIZE, SMOOTHING_TIME_CONSTANT, useSoundContext } from "@/contexts/sound-context";
import type { SoundStreamData } from "@/lib/types";

export function useSoundStream(deviceId: string): SoundStreamData {
  const [isInitialized, setIsInitialized] = useState(false);
  const audioContext = useSoundContext();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function initializeSound() {
      if (!deviceId || !audioContext) return;

      try {
        // Clean up existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Resume audio context if needed
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Get audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        // Setup analyzer
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

        // Setup source
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Store refs
        analyserRef.current = analyser;
        sourceRef.current = source;
        streamRef.current = stream;
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing sound stream:', error);
        setIsInitialized(false);
      }
    }

    initializeSound();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      setIsInitialized(false);
    };
  }, [deviceId, audioContext]);

  return {
    analyser: analyserRef.current,
    isInitialized,
  };
}
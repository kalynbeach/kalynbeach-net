"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FFT_SIZE, SMOOTHING_TIME_CONSTANT, useSoundContext } from "@/contexts/sound-context";
import type { SoundStreamData } from "@/lib/types/sound";

export function useSoundDeviceStream(deviceId: string): SoundStreamData {
  const [isInitialized, setIsInitialized] = useState(false);
  const { audioContext, status, initialize } = useSoundContext();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    cleanupRef.current = cleanup;
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [cleanup]);

  useEffect(() => {
    let mounted = true;

    async function initializeSound() {
      if (!deviceId || !audioContext) return;

      try {
        // Clean up existing stream
        cleanup();

        // Ensure AudioContext is active
        if (status === "suspended") {
          await initialize();
        }

        // Get audio stream with optimal settings for performance
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            // sampleRate: 48000,
            // sampleSize: 16,
            // channelCount: 1
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Setup analyzer with optimal settings
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;

        // Setup source
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Store refs
        analyserRef.current = analyser;
        sourceRef.current = source;
        streamRef.current = stream;
        
        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Error initializing sound stream:", error);
        cleanup();
      }
    }

    // Only initialize if the context is active or suspended
    if (status === "active" || status === "suspended") {
      initializeSound();
    }

    return () => {
      mounted = false;
      cleanup();
    };
  }, [deviceId, audioContext, status, initialize, cleanup]);

  return {
    stream: streamRef.current,
    analyser: analyserRef.current,
    isInitialized,
  };
}
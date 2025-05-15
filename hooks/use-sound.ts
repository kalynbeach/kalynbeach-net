"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  getAudioContext,
  getMediaStream,
} from "@/lib/sound";

export function useSound() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isDeviceSwitching, setIsDeviceSwitching] = useState(false);
  const [outputEnabled, setOutputEnabled] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Initialize web audio resources
  const initializeAudio = useCallback(
    async (deviceId?: string) => {
      try {
        setErrorMessage(null);
        setIsDeviceSwitching(true);

        audioContextRef.current = audioContextRef.current ?? getAudioContext();

        if (!audioContextRef.current) {
          console.error("Failed to create AudioContext");
          setErrorMessage("Failed to create AudioContext");
          return;
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        // If we already have a stream, stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Request microphone access with specific device if provided
        const constraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        };

        streamRef.current = await getMediaStream(constraints);

        if (!streamRef.current) {
          console.error("Failed to get MediaStream");
          setErrorMessage("Failed to get MediaStream");
          return;
        }

        sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(
          streamRef.current
        );
        gainNodeRef.current = audioContextRef.current.createGain();
        analyserNodeRef.current = audioContextRef.current.createAnalyser();
        analyserNodeRef.current.fftSize = 2048;

        gainNodeRef.current.gain.value = outputEnabled ? 1.0 : 0.0;
        sourceNodeRef.current.connect(analyserNodeRef.current);
        sourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        setIsInitialized(true);
        setIsDeviceSwitching(false);

        // Update selected device ID
        if (deviceId) {
          setSelectedDeviceId(deviceId);
        }
      } catch (error) {
        console.error("Error initializing audio:", error);
        setErrorMessage(
          error instanceof Error
            ? `Error: ${error.message}`
            : "Failed to access microphone. Please ensure you have a microphone connected and have granted permission."
        );
        setIsDeviceSwitching(false);
        cleanupAudio();
      }
    },
    [outputEnabled]
  );

  // Cleanup audio resources
  const cleanupAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
    }

    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;
    streamRef.current = null;
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    analyserNodeRef.current = null;

    setIsInitialized(false);
  }, []);

  const changeDevice = useCallback(
    (deviceId: string) => {
      if (deviceId === selectedDeviceId) return;
      if (isInitialized) {
        console.log(
          `[useSound changeDevice] initializing -> deviceId: ${deviceId}`
        );
        initializeAudio(deviceId);
      } else {
        console.log(
          `[useSound changeDevice] setting selectedDeviceId -> deviceId: ${deviceId}`
        );
        setSelectedDeviceId(deviceId);
      }
    },
    [isInitialized, initializeAudio, selectedDeviceId]
  );

  const start = useCallback(() => {
    if (!isInitialized) {
      initializeAudio(selectedDeviceId || undefined);
    }
  }, [isInitialized, initializeAudio, selectedDeviceId]);

  const stop = useCallback(() => {
    if (isInitialized) {
      cleanupAudio();
    }
  }, [isInitialized, cleanupAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const toggleOutput = useCallback((enabled: boolean) => {
    setOutputEnabled(enabled);

    if (!gainNodeRef.current) {
      return;
    }

    gainNodeRef.current.gain.value = enabled ? 1.0 : 0.0;
  }, []);

  return {
    isInitialized,
    errorMessage,
    audioContextRef,
    streamRef,
    sourceNode: sourceNodeRef.current,
    gainNode: gainNodeRef.current,
    analyserNode: analyserNodeRef.current,
    start,
    stop,
    changeDevice,
    selectedDeviceId,
    isDeviceSwitching,
    outputEnabled,
    toggleOutput,
  };
}

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { getAudioContext, getMediaStream } from "@/lib/sound";

type AudioResources = {
  audioContext: AudioContext | null;
  stream: MediaStream | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  gainNode: GainNode | null;
  analyserNode: AnalyserNode | null;
};

const emptyAudioResources: AudioResources = {
  audioContext: null,
  stream: null,
  sourceNode: null,
  gainNode: null,
  analyserNode: null,
};

export function useSound() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isDeviceSwitching, setIsDeviceSwitching] = useState(false);
  const [outputEnabled, setOutputEnabled] = useState(false);
  const [resources, setResources] =
    useState<AudioResources>(emptyAudioResources);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Cleanup audio resources (suspend AudioContext, keep it alive)
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

    if (
      audioContextRef.current &&
      audioContextRef.current.state === "running"
    ) {
      audioContextRef.current.suspend();
    }

    streamRef.current = null;
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    analyserNodeRef.current = null;

    setResources(emptyAudioResources);
    setIsInitialized(false);
  }, []);

  // Initialize web audio resources
  const initializeAudio = useCallback(
    async (deviceId?: string) => {
      try {
        setErrorMessage(null);
        setIsDeviceSwitching(true);

        // Create AudioContext if it doesn't exist or if it's closed
        if (
          !audioContextRef.current ||
          audioContextRef.current.state === "closed"
        ) {
          audioContextRef.current = getAudioContext();
        }

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
          audio:
            deviceId && deviceId !== ""
              ? { deviceId: { exact: deviceId } }
              : true,
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

        setResources({
          audioContext: audioContextRef.current,
          stream: streamRef.current,
          sourceNode: sourceNodeRef.current,
          gainNode: gainNodeRef.current,
          analyserNode: analyserNodeRef.current,
        });
        setIsInitialized(true);
        setIsDeviceSwitching(false);

        // Update selected device ID
        if (deviceId && deviceId !== "") {
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
    [cleanupAudio, outputEnabled]
  );

  // Final cleanup for unmount (actually close AudioContext)
  const finalCleanup = useCallback(() => {
    cleanupAudio();

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;
  }, [cleanupAudio]);

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
      initializeAudio(selectedDeviceId !== "" ? selectedDeviceId : undefined);
    }
  }, [isInitialized, initializeAudio, selectedDeviceId]);

  const stop = useCallback(() => {
    if (isInitialized) {
      cleanupAudio();
    }
  }, [isInitialized, cleanupAudio]);

  useEffect(() => {
    return () => {
      finalCleanup();
    };
  }, [finalCleanup]);

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
    ...resources,
    start,
    stop,
    changeDevice,
    selectedDeviceId,
    isDeviceSwitching,
    outputEnabled,
    toggleOutput,
  };
}

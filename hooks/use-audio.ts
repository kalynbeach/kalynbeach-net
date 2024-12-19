import { useEffect, useState, useCallback, useRef } from "react";
import { useAudioDevices } from "./use-audio-devices";
import type { AudioState } from "@/lib/types";
import { useAudioContext } from "@/contexts/audio-context";

export function useAudio() {
  const { getAudioContext, initializeAudioContext } = useAudioContext();
  const { audioDevices, selectedAudioDevice, setSelectedAudioDevice } = useAudioDevices();
  const audioStateRef = useRef<AudioState>({
    context: null,
    stream: null,
    analyzer: null,
    timeData: new Float32Array(2048),
    frequencyData: new Float32Array(1024),
  });
  const [audioState, setAudioState] = useState<AudioState>(audioStateRef.current);
  const [error, setError] = useState<Error | null>(null);

  const cleanup = useCallback(() => {
    if (audioStateRef.current.stream) {
      audioStateRef.current.stream.getTracks().forEach(track => track.stop());
    }
    const context = getAudioContext();
    if (context && context.state === 'running') {
      context.suspend();
    }
    const newState = {
      ...audioStateRef.current,
      stream: null,
      analyzer: null,
    };
    audioStateRef.current = newState;
    setAudioState(newState);
  }, [getAudioContext]);

  const initializeAudio = useCallback(async () => {
    if (!selectedAudioDevice) return;

    const existingContext = getAudioContext();
    if (existingContext && audioStateRef.current.stream && existingContext.state !== "closed") {
      if (existingContext.state === "suspended") {
        await existingContext.resume();
      }
      return;
    }

    try {
      cleanup();

      const context = initializeAudioContext();
      const analyzer = context.createAnalyser();
      analyzer.fftSize = 2048;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: selectedAudioDevice.deviceId,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      const source = context.createMediaStreamSource(stream);
      source.connect(analyzer);
      
      await context.resume();

      const newState = {
        context,
        analyzer,
        stream,
        timeData: new Float32Array(analyzer.fftSize),
        frequencyData: new Float32Array(analyzer.frequencyBinCount),
      };
      audioStateRef.current = newState;
      setAudioState(newState);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to initialize audio"));
      cleanup();
    }
  }, [selectedAudioDevice, cleanup, getAudioContext, initializeAudioContext]);

  // Single effect for initialization and cleanup
  useEffect(() => {
    initializeAudio();
    return cleanup;
  }, [selectedAudioDevice, initializeAudio, cleanup]);

  // Device change monitoring
  useEffect(() => {
    const handleDeviceChange = () => {
      if (selectedAudioDevice && 
          !audioDevices.some(device => device.deviceId === selectedAudioDevice.deviceId)) {
        initializeAudio();
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [audioDevices, selectedAudioDevice, initializeAudio]);

  return {
    audioDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
    audioState,
    error,
  };
}
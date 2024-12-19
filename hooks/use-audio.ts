import { useEffect, useState, useCallback, useRef, useTransition, useDeferredValue } from "react";
import { useAudioDevices } from "./use-audio-devices";
import { useAudioContext } from "@/contexts/audio-context";
import type { AudioState } from "@/lib/types";

export function useAudio() {
  const { audioContext, getAnalyzer, createAnalyzer, cleanup: contextCleanup } = useAudioContext();
  const { audioDevices, selectedAudioDevice, setSelectedAudioDevice } = useAudioDevices();
  const [isPending, startTransition] = useTransition();
  
  const audioStateRef = useRef<AudioState>({
    status: 'idle',
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
    if (audioContext.state === 'running') {
      audioContext.suspend();
    }
    const newState = {
      ...audioStateRef.current,
      status: 'idle' as const,
      stream: null,
      analyzer: null,
    };
    audioStateRef.current = newState;
    setAudioState(newState);
  }, [audioContext]);

  const initializeAudio = useCallback(async () => {
    if (!selectedAudioDevice) return;

    startTransition(async () => {
      try {
        cleanup();
        const analyzer = createAnalyzer();
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { 
            deviceId: selectedAudioDevice.deviceId,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyzer);
        
        await audioContext.resume();

        const newState = {
          status: 'active' as const,
          context: audioContext,
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
    });
  }, [selectedAudioDevice, cleanup, createAnalyzer, audioContext]);

  useEffect(() => {
    initializeAudio();
    return cleanup;
  }, [selectedAudioDevice, initializeAudio, cleanup]);

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

  const deferredAudioState = useDeferredValue(audioState);

  return {
    audioDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
    audioState: deferredAudioState,
    error,
    isPending,
  };
}
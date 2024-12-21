"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SoundContextValue, SoundDevicesData, SoundStreamData } from "@/lib/types";

export const FFT_SIZE = 2048;
export const SMOOTHING_TIME_CONSTANT = 0.8;

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundContextProvider({ children }: { children: React.ReactNode }) {
  const [audioContext] = useState<AudioContext | null>(() => 
    typeof window !== "undefined" ? new AudioContext() : null
  );

  return (
    <SoundContext.Provider value={{ audioContext }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundContext(): AudioContext | null {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSoundContext must be used within a SoundContextProvider");
  }
  return context.audioContext;
}

export function useSoundDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === "audioinput");
        setDevices(audioDevices);
        
        if (audioDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(audioDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Error accessing audio devices:", error);
      }
    }

    getDevices();
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getDevices);
    };
  }, []);

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
  };
}

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

        // Get audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        // Resume audio context if needed
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

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
    };
  }, [deviceId, audioContext]);

  return {
    analyser: analyserRef.current,
    isInitialized,
  };
}

export function useFrequencyData(analyser: AnalyserNode | null, isInitialized: boolean) {
  const dataArray = useRef<Uint8Array>(new Uint8Array());

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [analyser]);

  function getFrequencyData(): Uint8Array {
    if (!isInitialized || !analyser) return dataArray.current;
    analyser.getByteFrequencyData(dataArray.current);
    return dataArray.current;
  }

  return getFrequencyData;
}

export function useWaveformData(analyser: AnalyserNode | null, isInitialized: boolean) {
  const dataArray = useRef<Uint8Array>(new Uint8Array());

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [analyser]);

  function getWaveformData(): Uint8Array {
    if (!isInitialized || !analyser) return dataArray.current;
    analyser.getByteTimeDomainData(dataArray.current);
    return dataArray.current;
  }

  return getWaveformData;
}
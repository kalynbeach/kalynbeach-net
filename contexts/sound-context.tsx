"use client";

import { createContext, use, useRef, useState, useEffect } from "react";

interface SoundContextState {
  devices: MediaDeviceInfo[];
  activeDevice: MediaDeviceInfo | null;
  stream: MediaStream | null;
  context: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyzer: AnalyserNode | null;
}

interface SoundContextValue extends SoundContextState {
  setActiveDevice: (deviceId: string) => void;
}

export const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundContextProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SoundContextState>({
    devices: [],
    activeDevice: null,
    stream: null,
    context: null,
    source: null,
    analyzer: null,
  });

  // Initialize
  useEffect(() => {
    const initSound = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const activeDevice = devices.find(device => device.deviceId === 'default') || devices[0];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: activeDevice.deviceId,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyzer = context.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);
      setState({
        devices,
        activeDevice,
        stream,
        context,
        source,
        analyzer,
      });
    };
    initSound();
    return () => {
      // TODO: figure out what cleanup is needed
      state.context?.close();
    };
  }, []);

  // Update stream when active device changes
  useEffect(() => {
    async function updateStream() {
      if (!state.activeDevice || !state.context || !state.source || !state.analyzer) {
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: state.activeDevice.deviceId,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      state.stream = stream;
      state.source = state.context.createMediaStreamSource(stream);
      state.source.connect(state.analyzer);
    }
    updateStream();
    return () => {
      // TODO: figure out what cleanup is needed
      state.source?.disconnect();
    };
  }, [state]);

  async function setActiveDevice(deviceId: string) {
    const newActiveDevice = state.devices.find(device => device.deviceId === deviceId);
    if (newActiveDevice) {
      setState(prev => ({
        ...prev,
        activeDevice: newActiveDevice,
      }));
    }
  }

  return (
    <SoundContext.Provider value={{ ...state, setActiveDevice }}>
      {children}
    </SoundContext.Provider>
  );
}
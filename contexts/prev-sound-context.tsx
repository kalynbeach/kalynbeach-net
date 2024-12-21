"use client";

import { createContext, use, useState, useEffect, useCallback, useTransition } from "react";
import { initializeSoundDevices } from "@/hooks/use-prev-sound-devices";

interface SoundContextState {
  status: "idle" | "loading" | "active" | "error";
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
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<SoundContextState>({
    status: "idle" as const,
    devices: [],
    activeDevice: null,
    stream: null,
    context: null,
    source: null,
    analyzer: null,
  });

  useEffect(() => {
    async function getSoundDevices() {
      try {
        const { devices, activeDevice } = await initializeSoundDevices();
        setState(prev => ({
          ...prev,
          devices,
          activeDevice,
        }));
      } catch (error) {
        console.error("[SoundContext getSoundDevices] Error accessing sound devices:", error);
      }
    }

    getSoundDevices();
  }, []);

  const cleanup = useCallback(() => {
    console.log("[SoundContext cleanup] cleaning up...");
    if (state.stream) {
      console.log("[SoundContext cleanupSound] stopping stream tracks...");
      state.stream.getTracks().forEach(track => track.stop());
    }
    if (state.context?.state === "running") {
      console.log("[SoundContext cleanupSound] suspending context...");
      state.context.suspend();
    }
    setState(prev => ({
      ...prev,
      status: "idle" as const,
      stream: null,
      analyzer: null,
    }));
  }, [state.context]);

  const initializeSound = useCallback(async () => {
    // if (!state.activeDevice) return;
    startTransition(async () => {
      try {
        if (!state.activeDevice) return;
        console.log("[SoundContext initializeSound] initializing...");
        cleanup();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { 
            deviceId: state.activeDevice.deviceId,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
        const context = state.context ?? new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyzer = context.createAnalyser();
        analyzer.fftSize = 2048;
        source.connect(analyzer);
        await context.resume();
        setState(prev => ({
          ...prev,
          status: "active" as const,
          stream,
          context,
          source,
          analyzer,
        }));
      } catch (error) {
        console.error("[SoundContext initializeSound] Error initializing sound:", error);
        cleanup();
      }
    });
  }, [state.activeDevice, state.context, cleanup]);

  // Initialize
  useEffect(() => {
    initializeSound();
    return cleanup;
  }, [state.activeDevice, initializeSound, cleanup]);

  useEffect(() => {
    function handleDeviceChange() {
      if (state.activeDevice && 
          !state.devices.some(device => device.deviceId === state.activeDevice?.deviceId)) {
        initializeSound();
      }
    }
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [state.devices, state.activeDevice, initializeSound]);

  // useEffect(() => {
  //   async function initializeSound() {
  //     console.log("[SoundContext initializeSound] initializing...");

  //     // Devices
  //     const { devices, activeDevice } = await initializeSoundDevices();

  //     // Stream
  //     let stream: MediaStream | null = null;
  //     let context: AudioContext | null = state.context ?? null;
  //     let source: MediaStreamAudioSourceNode | null = null;
  //     let analyzer: AnalyserNode | null = null;

  //     if (activeDevice) {
  //       stream = await navigator.mediaDevices.getUserMedia({
  //         audio: { 
  //           deviceId: activeDevice.deviceId,
  //           echoCancellation: false,
  //           noiseSuppression: false,
  //           autoGainControl: false,
  //         }
  //       });

  //       // Web Audio APIs
  //       context = state.context ?? new AudioContext();
  //       source = context.createMediaStreamSource(stream);
  //       analyzer = context.createAnalyser();
  //       analyzer.fftSize = 2048;
  //       source.connect(analyzer);
  //     }

  //     // Web Audio APIs
  //     // const context = state.context ?? new AudioContext();
  //     // const source = context.createMediaStreamSource(stream);
  //     // const analyzer = context.createAnalyser();
  //     // analyzer.fftSize = 2048;
  //     // source.connect(analyzer);

  //     const newState = {
  //       status: "active" as const,
  //       devices,
  //       activeDevice,
  //       stream,
  //       context,
  //       source,
  //       analyzer,
  //     };

  //     setState(newState);

  //     // setState(prev => ({
  //     //   ...prev,
  //     //   status: "active" as const,
  //     //   devices,
  //     //   activeDevice,
  //     //   stream,
  //     //   context,
  //     //   source,
  //     //   analyzer,
  //     // }));
  //   };

  //   initializeSound();

  //   return () => {
  //     // TODO: figure out what cleanup is needed
  //     state.context?.close();
  //   };
  // }, []);

  // Update stream when active device changes
  // useEffect(() => {
  //   async function updateStream() {
  //     if (!state.activeDevice || !state.context || !state.source || !state.analyzer) {
  //       return;
  //     }

  //     const stream = await navigator.mediaDevices.getUserMedia({
  //       audio: { 
  //         deviceId: state.activeDevice.deviceId,
  //         echoCancellation: false,
  //         noiseSuppression: false,
  //         autoGainControl: false,
  //       }
  //     });

  //     const source = state.context.createMediaStreamSource(stream);
  //     source.connect(state.analyzer);

  //     await state.context.resume();

  //     setState(prev => ({
  //       ...prev,
  //       status: "active" as const,
  //       stream,
  //       source,
  //     }));
  //   }
  //   updateStream();
  //   return () => {
  //     // TODO: figure out what cleanup is needed
  //     // state.source?.disconnect();
  //     // cleanupSound();
  //   };
  // }, [state.activeDevice, state.context, state.source, state.analyzer, state.stream]);

  // useEffect(() => {
  //   function cleanupSound() {
  //     console.log("[SoundContext cleanupSound] cleaning up...");
  //     // state.source?.disconnect();
  //     if (state.stream) {
  //       console.log("[SoundContext cleanupSound] stopping stream tracks...");
  //       state.stream.getTracks().forEach(track => track.stop());
  //     }
  //     if (state.context?.state === "running") {
  //       console.log("[SoundContext cleanupSound] suspending context...");
  //       state.context.suspend();
  //     }
  //     setState(prev => ({
  //       ...prev,
  //       status: "idle" as const,
  //       stream: null,
  //       analyzer: null,
  //     }));
  //   }
  //   // cleanupSound();
  //   return () => {
  //     cleanupSound();
  //   };
  // }, [state.context]);

  function setActiveDevice(deviceId: string) {
    const newActiveDevice = state.devices.find(device => device.deviceId === deviceId);
    console.log("[SoundContext setActiveDevice] newActiveDevice:", newActiveDevice);
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
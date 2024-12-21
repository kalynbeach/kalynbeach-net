"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SoundContextValue } from "@/lib/types";

export const FFT_SIZE = 2048;
export const SMOOTHING_TIME_CONSTANT = 0.8;

let globalAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}

export const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundContextProvider({ children }: { children: React.ReactNode }) {
  const [audioContext] = useState<AudioContext | null>(getAudioContext);

  // Manage AudioContext lifecycle
  useEffect(() => {
    if (!audioContext) return;

    // Resume context when component mounts
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    return () => {
      // Suspend context when component unmounts
      if (audioContext.state === "running") {
        audioContext.suspend();
      }
    };
  }, [audioContext]);

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

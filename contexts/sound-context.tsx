"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SoundContextValue, AudioStatus, AudioError } from "@/lib/types";

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
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [error, setError] = useState<AudioError | null>(null);

  const initialize = async () => {
    try {
      setStatus('initializing');
      if (!audioContext) {
        throw new Error('AudioContext not available');
      }
      await audioContext.resume();
      setStatus('active');
      setError(null);
    } catch (err) {
      setError({
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize audio context',
        originalError: err as Error
      });
      setStatus('error');
    }
  };

  const suspend = async () => {
    try {
      if (audioContext?.state === 'running') {
        await audioContext.suspend();
        setStatus('suspended');
      }
    } catch (err) {
      setError({
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to suspend audio context',
        originalError: err as Error
      });
      setStatus('error');
    }
  };

  const resume = async () => {
    try {
      if (audioContext?.state === 'suspended') {
        await audioContext.resume();
        setStatus('active');
      }
    } catch (err) {
      setError({
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to resume audio context',
        originalError: err as Error
      });
      setStatus('error');
    }
  };

  // Initialize AudioContext when component mounts
  useEffect(() => {
    if (!audioContext) return;

    const initContext = async () => {
      try {
        // Check if we need user interaction first
        if (audioContext.state === 'suspended') {
          setStatus('suspended');
        } else {
          await initialize();
        }
      } catch (err) {
        console.error('Failed to initialize AudioContext:', err);
        setStatus('error');
      }
    };

    initContext();

    return () => {
      if (audioContext?.state === 'running') {
        suspend();
      }
    };
  }, [audioContext]);

  // Handle AudioContext state changes
  useEffect(() => {
    if (!audioContext) return;

    const handleStateChange = () => {
      switch (audioContext.state) {
        case 'running':
          setStatus('active');
          setError(null);
          break;
        case 'suspended':
          setStatus('suspended');
          break;
        case 'closed':
          setStatus('error');
          setError({
            code: 'INITIALIZATION_FAILED',
            message: 'Audio context was closed'
          });
          break;
      }
    };

    audioContext.addEventListener('statechange', handleStateChange);
    return () => {
      audioContext.removeEventListener('statechange', handleStateChange);
    };
  }, [audioContext]);

  return (
    <SoundContext.Provider value={{ 
      audioContext,
      status,
      error,
      initialize,
      suspend,
      resume
    }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundContext(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSoundContext must be used within a SoundContextProvider");
  }
  return context;
}

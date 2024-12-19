"use client";

import React, { createContext, useContext, useRef, useCallback, use, cache, useEffect } from "react";

interface AudioContextValue {
  audioContext: AudioContext;
  createAnalyzer: () => AnalyserNode;
}

const AudioContextInstance = createContext<AudioContextValue | null>(null);

// Cache the promise creation with browser check
const createAudioContext = cache(async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return new (window.AudioContext || (window as any).webkitAudioContext)();
});

// Create a stable promise instance
const audioContextPromise = typeof window !== 'undefined' ? createAudioContext() : Promise.resolve(null);

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const audioContext = use(audioContextPromise) as AudioContext;
  const analyzerRef = useRef<AnalyserNode | null>(null);

  const createAnalyzer = useCallback(() => {
    if (!analyzerRef.current) {
      analyzerRef.current = audioContext.createAnalyser();
      analyzerRef.current.fftSize = 2048;
    }
    return analyzerRef.current;
  }, [audioContext]);

  // Don't render anything on the server
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <AudioContextInstance.Provider value={{ 
      audioContext,
      createAnalyzer
    }}>
      {children}
    </AudioContextInstance.Provider>
  );
}

export function useAudioContext() {
  const context = useContext(AudioContextInstance);
  if (!context) {
    throw new Error("useAudioContext must be used within an AudioContextProvider");
  }
  return context;
}
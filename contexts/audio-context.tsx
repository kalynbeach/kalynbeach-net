"use client";

import React, { createContext, useContext, useRef, useCallback } from 'react';
import type { AudioState } from '@/lib/types';

interface AudioContextValue {
  getAudioContext: () => AudioContext | null;
  initializeAudioContext: () => AudioContext;
  cleanup: () => void;
}

const AudioContextInstance = createContext<AudioContextValue | null>(null);

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    return audioContextRef.current;
  }, []);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const cleanup = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return (
    <AudioContextInstance.Provider value={{ 
      getAudioContext, 
      initializeAudioContext,
      cleanup 
    }}>
      {children}
    </AudioContextInstance.Provider>
  );
}

export const useAudioContext = () => {
  const context = useContext(AudioContextInstance);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioContextProvider');
  }
  return context;
};
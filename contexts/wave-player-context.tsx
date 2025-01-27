"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type {
  WavePlayerContextValue,
  WavePlayerState,
  WavePlayerPlaylist,
  WavePlayerTrack,
  WavePlayerControls,
} from "@/lib/types";

// AudioContext settings
const FFT_SIZE = 2048;
const SMOOTHING_TIME_CONSTANT = 0.8;

const initialState: WavePlayerState = {
  status: "idle",
  playlist: null,
  track: null,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isLooping: false,
  error: null,
};

export const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

export function WavePlayerContextProvider({
  children,
  playlist,
}: {
  children: React.ReactNode;
  playlist: WavePlayerPlaylist;
}) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isCleanedUpRef = useRef(false);

  const [tracks] = useState<WavePlayerTrack[]>(playlist.tracks);
  const [state, setState] = useState<WavePlayerState>({
    ...initialState,
    playlist,
    track: tracks[0],
  });

  // TODO: initialize audio context and nodes
  const initialize = useCallback(async () => {
    try {
      if (audioContext || isCleanedUpRef.current) return;

      const ctx = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 48000,
      });

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const gain = ctx.createGain();
      gain.gain.value = state.volume;

      gain.connect(ctx.destination);
      analyser.connect(gain);

      analyserRef.current = analyser;
      gainRef.current = gain;
      setAudioContext(ctx);
      isCleanedUpRef.current = false;
      
      setState(prev => ({ ...prev, status: "ready" }));
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      setState(prev => ({
        ...prev,
        status: "error",
        error: error as Error,
      }));
    }
  }, [audioContext, state.volume]);

  const cleanup = useCallback(() => {
    isCleanedUpRef.current = true;

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {
        console.error("Error stopping source:", e);
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        console.error("Error disconnecting analyser:", e);
      }
      analyserRef.current = null;
    }

    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
      } catch (e) {
        console.error("Error disconnecting gain:", e);
      }
      gainRef.current = null;
    }

    if (audioContext && audioContext.state !== "closed") {
      try {
        audioContext.close();
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
    }

    // audioBufferCache.current.clear();
    setAudioContext(null);
    setState(initialState);
  }, [audioContext]);

  // TODO?: update audio nodes on track change

  // TODO: implement control functions and effects
  const controls: WavePlayerControls = {
    play: async () => {},
    pause: () => {},
    stop: () => {},
    seek: (time: number) => {},
    previous: async () => {},
    next: async () => {},
    toggleLoop: () => {},
    setVolume: (level: number) => {},
  };

  const contextValue: WavePlayerContextValue = {
    audioContext,
    analyserNode: analyserRef.current,
    gainNode: gainRef.current,
    sourceNode: sourceRef.current,
    state,
    controls,
    initialize,
    cleanup,
  };

  return (
    <WavePlayerContext.Provider value={contextValue}>
      {children}
    </WavePlayerContext.Provider>
  );
}

export function useWavePlayerContext(): WavePlayerContextValue {
  const context = useContext(WavePlayerContext);
  if (!context) {
    throw new Error("useWavePlayerContext must be used within a WavePlayerContextProvider");
  }
  return context;
}
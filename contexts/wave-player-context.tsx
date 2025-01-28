"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type {
  WavePlayerContextValue,
  WavePlayerState,
  WavePlayerPlaylist,
  WavePlayerTrack,
  WavePlayerControls,
} from "@/lib/types";

// TESTING
export const TEST_TRACKS: WavePlayerTrack[] = [
  {
    id: 0,
    title: "0_initializer",
    artist: "Kalyn Beach",
    record: "loops",
    src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
    image: {
      src: "/icon.svg",
      alt: "0_initializer",
    },
    isLoop: true,
  },
];

export const TEST_PLAYLIST: WavePlayerPlaylist = {
  id: 0,
  title: "playlist_0",
  tracks: TEST_TRACKS,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// AudioContext options
const FFT_SIZE = 2048;
const SMOOTHING_TIME_CONSTANT = 0.8;

const initialState: WavePlayerState = {
  status: "idle",
  playlist: TEST_PLAYLIST,
  track: TEST_PLAYLIST.tracks[0],
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isLooping: false,
  error: null,
};

export const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

export function WavePlayerContextProvider({ children }: { children: React.ReactNode; }) {
  // TODO: refactor `state` out of `WavePlayerContextProvider` and into `useWavePlayer` state
  const [state, setState] = useState<WavePlayerState>(initialState);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isCleanedUpRef = useRef(false);
  
  // TODO: prevent duplicate AudioContexts from being created
  const createAudioContext = () => {
    if (typeof window === "undefined") return null;
    return new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000,
    });
  };

  const resumeAudioContext = async () => {
    if (audioContext && audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  // TODO: properly initialize audio context and nodes
  const initialize = useCallback(async (playlist: WavePlayerPlaylist) => {
    try {
      if (audioContext || isCleanedUpRef.current) return;
      // console.log("[WavePlayerContextProvider] initializing...");

      // set playlist and track in state
      setState(prev => ({
        ...prev,
        playlist,
        track: playlist.tracks[0],
      }));

      // const ctx = new AudioContext({
      //   latencyHint: "interactive",
      //   sampleRate: 48000,
      // });

      const ctx = createAudioContext();
      if (!ctx) return;

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
      // console.log("[WavePlayerContextProvider] initialized!");
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

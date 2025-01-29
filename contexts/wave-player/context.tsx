"use client";

import { createContext, useContext, useReducer, useRef, useEffect, useCallback, useMemo } from "react";
import type { WavePlayerContextValue, WavePlayerState, WavePlayerPlaylist, WavePlayerTrack, WavePlayerControls } from "@/lib/types/wave-player";

const initialState: WavePlayerState = {
  audioContext: null,
  status: "idle",
  track: null,
  buffer: null,
  bufferProgress: 0,
  currentTime: 0,
  startTime: 0,
  duration: 0,
  volume: 1,
  visualization: {
    waveform: null,
    frequencies: null
  },
  isMuted: false,
  isLooping: false,
  error: null,
};

type WavePlayerAction =
  | { type: "INITIALIZE"; payload: { audioContext: AudioContext } }
  | { type: "SET_BUFFER"; payload: AudioBuffer | null }
  | { type: "SET_TRACK"; payload: WavePlayerTrack | null }
  | { type: "SET_STATUS"; payload: WavePlayerState["status"] }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "SET_ERROR"; payload: Error | null }
  | { type: "SET_VISUALIZATION"; payload: { waveform: Uint8Array | null; frequencies: Uint8Array | null } }
  | { type: "SET_VOLUME"; payload: number }
  | { type: "SET_CURRENT_TIME"; payload: number }
  | { type: "SET_START_TIME"; payload: number }
  | { type: "RETRY_LOAD" };

function playerReducer(state: WavePlayerState, action: WavePlayerAction): WavePlayerState {
  switch (action.type) {
    case "INITIALIZE":
      return { ...state, audioContext: action.payload.audioContext };
    case "SET_BUFFER":
      return { ...state, buffer: action.payload };
    case "SET_TRACK":
      return { ...state, track: action.payload };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_PROGRESS":
      return { ...state, bufferProgress: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, status: "error" };
    case "SET_VISUALIZATION":
      return { ...state, visualization: action.payload };
    case "SET_VOLUME":
      return { ...state, volume: action.payload };
    case "SET_CURRENT_TIME":
      return { ...state, currentTime: action.payload };
    case "SET_START_TIME":
      return { ...state, startTime: action.payload };
    case "RETRY_LOAD":
      return { ...state, status: "loading", error: null };
    default:
      return state;
  }
}

const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

export function WavePlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  const createAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) {
      return audioContextRef.current;
    }
    const ctx = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000,
    });
    audioContextRef.current = ctx;
    return ctx;
  };

  const resumeAudioContext = useCallback(async () => {
    if (state.audioContext && state.audioContext.state === "suspended") {
      console.log("[WavePlayerProvider resumeAudioContext] resuming audio context");
      await state.audioContext.resume();
    }
  }, [state.audioContext]);

  const initializeAudioContext = useCallback(async () => {
    try {
      console.log("[WavePlayerProvider initializeAudioContext] initializing audio context");
      const audioContext = createAudioContext();
      if (!audioContext) {
        throw new Error("Audio context could not be created");
      }

      console.log("[WavePlayerProvider initializeAudioContext] resuming audio context");
      await resumeAudioContext();
      
      // Initialize audio nodes
      analyserNodeRef.current = audioContext.createAnalyser();
      gainNodeRef.current = audioContext.createGain();
      
      // Connect node chain
      gainNodeRef.current.connect(audioContext.destination);
      analyserNodeRef.current.connect(gainNodeRef.current);
      
      dispatch({ type: "INITIALIZE", payload: { audioContext } });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error("Audio context initialization failed") });
    }
  }, []);

  const loadTrack = useCallback(async (track: WavePlayerTrack) => {
    if (!state.audioContext) return;

    console.log("[WavePlayerProvider loadTrack] loading track...");
    
    try {
      dispatch({ type: "SET_STATUS", payload: "loading" });
      dispatch({ type: "SET_TRACK", payload: track });
      
      const response = await fetch(track.src);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await state.audioContext.decodeAudioData(arrayBuffer);      
      console.log("[WavePlayerProvider loadTrack] setting buffer:", buffer);

      dispatch({ type: "SET_BUFFER", payload: buffer });
      dispatch({ type: "SET_STATUS", payload: "ready" });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error("Track loading failed") });
    }
  }, [state.audioContext]);

  const play = useCallback(async () => {
    if (!state.audioContext || !state.buffer) return;
    
    console.log("[WavePlayerProvider play] playing track...");
    
    try {
      // Resume context if suspended
      if (state.audioContext.state === "suspended") {
        console.log("[WavePlayerProvider play] resuming audio context");
        await state.audioContext.resume();
      }
      
      // Create new source node
      sourceNodeRef.current = state.audioContext.createBufferSource();
      sourceNodeRef.current.buffer = state.buffer;
      sourceNodeRef.current.connect(analyserNodeRef.current!);
      
      // Start playback
      const startTime = state.audioContext.currentTime - (pauseTimeRef.current || 0);
      sourceNodeRef.current.start(0, pauseTimeRef.current);
      startTimeRef.current = startTime;
      
      dispatch({ type: "SET_STATUS", payload: "playing" });
      dispatch({ type: "SET_START_TIME", payload: startTime });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error : new Error("Playback failed") });
    }
  }, [state.audioContext, state.buffer]);

  const pause = useCallback(() => {
    if (!state.audioContext || !sourceNodeRef.current) return;
    
    sourceNodeRef.current.stop();
    pauseTimeRef.current = state.audioContext.currentTime - startTimeRef.current;
    dispatch({ type: "SET_STATUS", payload: "paused" });
  }, [state.audioContext]);

  const setVolume = useCallback((volume: number) => {
    if (!gainNodeRef.current) return;
    
    gainNodeRef.current.gain.setValueAtTime(
      volume,
      state.audioContext?.currentTime || 0
    );
    
    dispatch({ type: "SET_VOLUME", payload: volume });
  }, [state.audioContext]);

  const seek = useCallback((time: number) => {
    if (!state.audioContext || !state.buffer) return;

    // Stop current playback
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }

    // Create new source node
    sourceNodeRef.current = state.audioContext.createBufferSource();
    sourceNodeRef.current.buffer = state.buffer;
    sourceNodeRef.current.connect(analyserNodeRef.current!);

    // Update timing references
    startTimeRef.current = state.audioContext.currentTime - time;
    pauseTimeRef.current = time;

    // Start playback if currently playing
    if (state.status === "playing") {
      sourceNodeRef.current.start(0, time);
    }

    dispatch({ type: "SET_CURRENT_TIME", payload: time });
  }, [state.audioContext, state.buffer, state.status]);

  const retryLoad = useCallback(() => {
    if (state.track) {
      console.log("[WavePlayerProvider retryLoad] retrying load - track:", state.track);
      dispatch({ type: "RETRY_LOAD" });
      loadTrack(state.track);
    }
  }, [state.track, loadTrack]);

  const cleanupBuffer = useCallback(() => {
    if (sourceNodeRef.current) {
      console.log("[WavePlayerProvider cleanupBuffer] disconnecting source node");
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    dispatch({ type: "SET_BUFFER", payload: null });
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    
    const updateTime = () => {
      if (state.audioContext && state.startTime) {
        const currentTime = state.audioContext.currentTime - state.startTime;
        dispatch({ type: "SET_CURRENT_TIME", payload: currentTime });
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };

    if (state.status === "playing") {
      updateTime();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [state.status, state.audioContext, state.startTime]);

  useEffect(() => {
    if (!analyserNodeRef.current || state.status !== "playing") return;

    const updateVisualization = () => {
      const visualizationBuffer = new Uint8Array(analyserNodeRef.current!.frequencyBinCount);
      analyserNodeRef.current!.getByteTimeDomainData(visualizationBuffer);
      const waveform = visualizationBuffer.slice();
      analyserNodeRef.current!.getByteFrequencyData(visualizationBuffer);
      const frequencies = visualizationBuffer.slice();

      dispatch({ 
        type: "SET_VISUALIZATION",
        payload: { waveform, frequencies }
      });
      
      if (state.status === "playing") {
        requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }, [state.status]);

  const value: WavePlayerContextValue = useMemo(() => ({
    state,
    controls: {
      play,
      pause,
      setVolume,
      seek,
    },
    loadTrack,
    initializeAudioContext,
    retryLoad,
    cleanupBuffer,
  }), [state, play, pause, loadTrack, initializeAudioContext, retryLoad, cleanupBuffer]);

  return (
    <WavePlayerContext.Provider value={value}>
      {children}
    </WavePlayerContext.Provider>
  );
}

export function useWavePlayerContext() {
  const context = useContext(WavePlayerContext);
  if (!context) {
    throw new Error("useWavePlayerContext must be used within a WavePlayerProvider");
  }
  return context;
}
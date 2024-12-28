"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  WavePlayerContextValue,
  WavePlayerPlaylist,
  WavePlayerState,
  WavePlayerTrack,
} from "@/lib/types";

// Audio settings
const FFT_SIZE = 2048;
const SMOOTHING_TIME_CONSTANT = 0.8;

const initialState: WavePlayerState = {
  status: "idle",
  currentTrack: null,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isLoop: false,
  isShuffle: false,
  error: null,
};

const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

export function WavePlayerProvider({
  children,
  playlist = [],
}: {
  children: React.ReactNode;
  playlist?: WavePlayerPlaylist;
}) {
  // Audio nodes
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isCleanedUpRef = useRef(false);
  
  // State
  const [tracks] = useState<WavePlayerPlaylist>(playlist);
  const [state, setState] = useState<WavePlayerState>({
    ...initialState,
    currentTrack: tracks[0] || null,
  });
  const audioBufferCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Set initial track if tracks change and current track is null
  useEffect(() => {
    if (tracks.length > 0 && !state.currentTrack) {
      setState(prev => ({ ...prev, currentTrack: tracks[0] }));
    }
  }, [tracks, state.currentTrack]);

  // Initialize audio context and nodes
  const initialize = useCallback(async () => {
    try {
      if (audioContext || isCleanedUpRef.current) return;

      const ctx = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 48000,
      });

      // Create and configure nodes
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const gain = ctx.createGain();
      gain.gain.value = state.volume;

      // Connect nodes
      gain.connect(ctx.destination);
      analyser.connect(gain);

      // Store references
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

  // Load and cache audio buffer
  const loadAudioBuffer = useCallback(async (track: WavePlayerTrack) => {
    if (!audioContext || isCleanedUpRef.current) return null;
    
    // Check cache first
    if (audioBufferCache.current.has(track.src)) {
      return audioBufferCache.current.get(track.src)!;
    }

    try {
      const response = await fetch(track.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Cache the decoded buffer
      audioBufferCache.current.set(track.src, audioBuffer);
      
      return audioBuffer;
    } catch (error) {
      console.error("Failed to load audio:", error);
      throw error;
    }
  }, [audioContext]);

  // Playback controls
  const controls = {
    play: async () => {
      if (!audioContext || !state.currentTrack || isCleanedUpRef.current) return;
      
      try {
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Stop current playback if any
        if (sourceRef.current) {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        }

        // Create and configure new source
        const buffer = await loadAudioBuffer(state.currentTrack);
        if (!buffer) return;

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = state.isLoop;
        source.connect(analyserRef.current!);
        
        // Store source reference
        sourceRef.current = source;

        // Start playback
        source.start(0, state.currentTime);
        setState(prev => ({
          ...prev,
          status: "playing",
          duration: buffer.duration,
        }));

        // Handle track end
        source.onended = () => {
          if (!state.isLoop && !isCleanedUpRef.current) {
            controls.next();
          }
        };
      } catch (error) {
        console.error("Playback failed:", error);
        setState(prev => ({
          ...prev,
          status: "error",
          error: error as Error,
        }));
      }
    },

    pause: () => {
      if (audioContext?.state === "running" && !isCleanedUpRef.current) {
        audioContext.suspend();
        setState(prev => ({ ...prev, status: "paused" }));
      }
    },

    stop: () => {
      if (sourceRef.current && !isCleanedUpRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      setState(prev => ({
        ...prev,
        status: "ready",
        currentTime: 0,
      }));
    },

    seek: (time: number) => {
      if (time >= 0 && time <= state.duration && !isCleanedUpRef.current) {
        setState(prev => ({ ...prev, currentTime: time }));
        if (state.status === "playing") {
          controls.play(); // Restart from new position
        }
      }
    },

    setVolume: (level: number) => {
      if (gainRef.current && level >= 0 && level <= 1 && !isCleanedUpRef.current) {
        gainRef.current.gain.value = level;
        setState(prev => ({ ...prev, volume: level }));
      }
    },

    next: async () => {
      if (!state.currentTrack || tracks.length === 0 || isCleanedUpRef.current) return;
      
      const currentIndex = tracks.findIndex(t => t.id === state.currentTrack!.id);
      const nextIndex = state.isShuffle
        ? Math.floor(Math.random() * tracks.length)
        : (currentIndex + 1) % tracks.length;
      
      setState(prev => ({ ...prev, currentTrack: tracks[nextIndex] }));
      if (state.status === "playing") {
        await controls.play();
      }
    },

    previous: async () => {
      if (!state.currentTrack || tracks.length === 0 || isCleanedUpRef.current) return;
      
      const currentIndex = tracks.findIndex(t => t.id === state.currentTrack!.id);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
      
      setState(prev => ({ ...prev, currentTrack: tracks[prevIndex] }));
      if (state.status === "playing") {
        await controls.play();
      }
    },

    toggleLoop: () => {
      if (isCleanedUpRef.current) return;
      setState(prev => ({ ...prev, isLoop: !prev.isLoop }));
      if (sourceRef.current) {
        sourceRef.current.loop = !state.isLoop;
      }
    },

    toggleShuffle: () => {
      if (isCleanedUpRef.current) return;
      setState(prev => ({ ...prev, isShuffle: !prev.isShuffle }));
    },
  };

  // Cleanup function
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

    audioBufferCache.current.clear();
    setAudioContext(null);
    setState(initialState);
  }, [audioContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const contextValue: WavePlayerContextValue = {
    audioContext,
    analyserNode: analyserRef.current,
    gainNode: gainRef.current,
    sourceNode: sourceRef.current,
    state,
    controls,
    playlist: tracks,
    initialize,
    cleanup,
  };

  return (
    <WavePlayerContext.Provider value={contextValue}>
      {children}
    </WavePlayerContext.Provider>
  );
}

export function useWavePlayerContext() {
  const context = useContext(WavePlayerContext);
  if (!context) {
    throw new Error("useWavePlayerContext must be used within WavePlayerProvider");
  }
  return context;
}

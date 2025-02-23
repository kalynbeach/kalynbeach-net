"use client";

import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  WavePlayerContextValue,
  WavePlayerState,
  WavePlayerTrack,
  WavePlayerAction,
  WavePlayerPlaylist,
} from "@/lib/types/wave-player";
import { WavePlayerBufferPool } from "@/lib/wave-player/buffer-pool";

const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

const initialState: WavePlayerState = {
  audioContext: null,
  status: "idle",
  playlist: null,
  currentTrackIndex: 0,
  track: null,
  buffer: null,
  bufferProgress: 0,
  currentTime: 0,
  startTime: 0,
  duration: 0,
  volume: 1,
  visualization: {
    waveform: null,
    frequencies: null,
  },
  isMuted: false,
  isLooping: false,
  error: null,
};

// Single global audio context instance
let globalAudioContext: AudioContext | null = null;

function wavePlayerReducer(
  state: WavePlayerState,
  action: WavePlayerAction
): WavePlayerState {
  switch (action.type) {
    case "INITIALIZE":
      return { ...state, audioContext: action.payload.audioContext };
    case "SET_BUFFER":
      return { ...state, buffer: action.payload };
    case "SET_TRACK": {
      const newTrack = action.payload;
      return {
        ...state,
        track: newTrack,
        currentTrackIndex:
          newTrack && state.playlist
            ? state.playlist.tracks.findIndex((t) => t.id === newTrack.id)
            : 0,
      };
    }
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
    case "SET_DURATION":
      return { ...state, duration: action.payload };
    case "SET_LOOP":
      return { ...state, isLooping: action.payload };
    case "RETRY_LOAD":
      return { ...state, status: "loading", error: null };
    default:
      return state;
  }
}

export function WavePlayerProvider({
  children,
  playlist,
}: {
  children: React.ReactNode;
  playlist?: WavePlayerPlaylist;
}) {
  const [state, dispatch] = useReducer(wavePlayerReducer, {
    ...initialState,
    playlist: playlist || null,
  });

  // Audio node refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Timing refs
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Buffer management
  const bufferPoolRef = useRef<WavePlayerBufferPool | null>(null);

  const createAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      const error = new Error("AudioContext not supported");
      dispatch({ type: "SET_ERROR", payload: error });
      return null;
    }

    try {
      // Reuse existing global context if available
      if (globalAudioContext) {
        if (globalAudioContext.state === "suspended") {
          globalAudioContext.resume().catch(console.error);
        }
        audioContextRef.current = globalAudioContext;
        return globalAudioContext;
      }

      // Create new context if needed
      const ctx = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 48000,
      });
      globalAudioContext = ctx;
      audioContextRef.current = ctx;
      return ctx;
    } catch (error) {
      console.error("[WavePlayerProvider] Error creating AudioContext:", error);
      const finalError = new Error("AudioContext not supported");
      dispatch({ type: "SET_ERROR", payload: finalError });
      throw finalError;
    }
  }, [dispatch]);

  const cleanupAudioNodes = useCallback(() => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clean up source node
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current.buffer = null;
      sourceNodeRef.current = null;
    }

    // Clean up analyser node
    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }

    // Clean up gain node
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    // Reset timing refs
    startTimeRef.current = 0;
    pauseTimeRef.current = 0;
  }, []);

  const initializeAudioNodes = useCallback(
    (audioContext: AudioContext) => {
      // Clean up existing nodes first
      cleanupAudioNodes();

      // Create new nodes
      analyserNodeRef.current = audioContext.createAnalyser();
      analyserNodeRef.current.fftSize = 2048;
      analyserNodeRef.current.smoothingTimeConstant = 0.8;

      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = state.volume;

      // Connect nodes
      gainNodeRef.current.connect(audioContext.destination);
      analyserNodeRef.current.connect(gainNodeRef.current);
    },
    [state.volume, cleanupAudioNodes]
  );

  const initialize = useCallback(async () => {
    try {
      console.log("[WavePlayerProvider initialize] initializing audio context");
      const audioContext = createAudioContext();
      if (!audioContext) {
        const error = new Error("AudioContext not supported");
        dispatch({ type: "SET_ERROR", payload: error });
        throw error;
      }

      // Initialize audio nodes
      initializeAudioNodes(audioContext);

      // Initialize buffer pool with optimized settings
      if (!bufferPoolRef.current) {
        bufferPoolRef.current = new WavePlayerBufferPool({
          maxPoolSize: 50 * 1024 * 1024, // 50MB limit
          chunkSize: 256 * 1024, // 256KB chunks
          onProgress: (progress) => {
            dispatch({ type: "SET_PROGRESS", payload: progress });
          },
          onError: (error) => {
            dispatch({ type: "SET_ERROR", payload: error });
          },
        });
      }

      dispatch({ type: "INITIALIZE", payload: { audioContext } });
    } catch (error) {
      const finalError = error instanceof Error ? error : new Error("AudioContext not supported");
      dispatch({ type: "SET_ERROR", payload: finalError });
      throw finalError;
    }
  }, [createAudioContext, initializeAudioNodes]);

  const loadTrack = useCallback(
    async (track: WavePlayerTrack) => {
      if (!state.audioContext || !bufferPoolRef.current) return;

      console.log("[WavePlayerProvider loadTrack] loading track...");

      try {
        dispatch({ type: "SET_STATUS", payload: "loading" });
        dispatch({ type: "SET_TRACK", payload: track });
        dispatch({ type: "SET_LOOP", payload: track.isLoop });

        // Use buffer pool for chunked loading
        const buffer = await bufferPoolRef.current.loadTrackChunked(
          track,
          state.audioContext
        );

        dispatch({ type: "SET_BUFFER", payload: buffer });
        dispatch({ type: "SET_DURATION", payload: buffer.duration });
        dispatch({ type: "SET_STATUS", payload: "ready" });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload:
            error instanceof Error ? error : new Error("Track loading failed"),
        });
      }
    },
    [state.audioContext]
  );

  const retryLoad = useCallback(() => {
    if (state.track) {
      console.log(
        "[WavePlayerProvider retryLoad] retrying load - track:",
        state.track
      );
      dispatch({ type: "RETRY_LOAD" });
      loadTrack(state.track);
    }
  }, [state.track, loadTrack]);

  const cleanup = useCallback(() => {
    console.log(
      "[WavePlayerProvider cleanup] Cleaning up audio nodes and suspending context"
    );

    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (bufferPoolRef.current) {
      bufferPoolRef.current.cleanup();
    }

    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (globalAudioContext && globalAudioContext.state !== "closed") {
      globalAudioContext.suspend().catch((error) => {
        console.error(
          "[WavePlayerProvider cleanup] Error suspending context:",
          error
        );
      });
    }
    dispatch({ type: "SET_BUFFER", payload: null });
  }, []);

  const seek = useCallback(
    (time: number) => {
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
    },
    [state.audioContext, state.buffer, state.status]
  );

  const play = useCallback(async () => {
    if (!state.audioContext || !state.buffer || !state.track) return;

    try {
      // Resume context if suspended
      if (state.audioContext.state === "suspended") {
        await state.audioContext.resume();
      }

      // Clean up existing source node with fade out
      if (sourceNodeRef.current) {
        const oldSource = sourceNodeRef.current;
        const fadeOutDuration = 0.05; // 50ms fade
        gainNodeRef.current?.gain.setValueAtTime(
          state.volume,
          state.audioContext.currentTime
        );
        gainNodeRef.current?.gain.linearRampToValueAtTime(
          0,
          state.audioContext.currentTime + fadeOutDuration
        );

        // Schedule the old source cleanup
        setTimeout(() => {
          oldSource.stop();
          oldSource.disconnect();
        }, fadeOutDuration * 1000);
      }

      // Create new source node
      sourceNodeRef.current = state.audioContext.createBufferSource();
      sourceNodeRef.current.buffer = state.buffer;
      sourceNodeRef.current.loop = state.track.isLoop;
      sourceNodeRef.current.connect(analyserNodeRef.current!);

      // Handle track completion
      if (!state.track.isLoop) {
        sourceNodeRef.current.onended = () => {
          cleanupAudioNodes();
          dispatch({ type: "SET_STATUS", payload: "ready" });
          dispatch({ type: "SET_CURRENT_TIME", payload: 0 });
        };
      }

      // Calculate correct start time for looping tracks
      let startOffset = pauseTimeRef.current || 0;
      if (state.track.isLoop && startOffset > 0) {
        // Ensure the offset is within the buffer duration
        startOffset = startOffset % state.buffer.duration;
      }

      // Start playback from the correct offset with fade in
      const startTime = state.audioContext.currentTime - startOffset;
      sourceNodeRef.current.start(0, startOffset);
      startTimeRef.current = startTime;

      // Fade in the new source
      gainNodeRef.current?.gain.setValueAtTime(
        0,
        state.audioContext.currentTime
      );
      gainNodeRef.current?.gain.linearRampToValueAtTime(
        state.volume,
        state.audioContext.currentTime + 0.05
      );

      dispatch({ type: "SET_STATUS", payload: "playing" });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error : new Error("Playback failed"),
      });
    }
  }, [
    state.audioContext,
    state.buffer,
    state.track,
    state.volume,
    cleanupAudioNodes,
  ]);

  const pause = useCallback(async () => {
    if (!state.audioContext || !sourceNodeRef.current) return;

    try {
      // Store the current time before pausing
      pauseTimeRef.current =
        state.audioContext.currentTime - startTimeRef.current;

      // Fade out before stopping
      const fadeOutDuration = 0.05; // 50ms fade
      gainNodeRef.current?.gain.setValueAtTime(
        state.volume,
        state.audioContext.currentTime
      );
      gainNodeRef.current?.gain.linearRampToValueAtTime(
        0,
        state.audioContext.currentTime + fadeOutDuration
      );

      // Schedule the source node cleanup after fade
      setTimeout(() => {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
        // Reset gain for next playback
        if (state.audioContext && gainNodeRef.current) {
          gainNodeRef.current.gain.setValueAtTime(
            state.volume,
            state.audioContext.currentTime
          );
        }
      }, fadeOutDuration * 1000);

      dispatch({ type: "SET_STATUS", payload: "paused" });
    } catch (error) {
      console.error(
        "[WavePlayerProvider pause] Error pausing playback:",
        error
      );
    }
  }, [state.audioContext, state.volume]);

  const previousTrack = useCallback(() => {
    if (!state.playlist) return;
    const prevIndex =
      state.currentTrackIndex === 0
        ? state.playlist.tracks.length - 1
        : state.currentTrackIndex - 1;
    const prevTrack = state.playlist.tracks[prevIndex];
    dispatch({ type: "SET_TRACK", payload: prevTrack });
    loadTrack(prevTrack);
  }, [state.playlist, state.currentTrackIndex]);

  const nextTrack = useCallback(() => {
    if (!state.playlist) return;
    const nextIndex =
      (state.currentTrackIndex + 1) % state.playlist.tracks.length;
    const nextTrack = state.playlist.tracks[nextIndex];
    dispatch({ type: "SET_TRACK", payload: nextTrack });
    loadTrack(nextTrack);
  }, [state.playlist, state.currentTrackIndex]);

  const setLoop = useCallback((loop: boolean) => {
    dispatch({ type: "SET_LOOP", payload: loop });
  }, []);

  const setVolume = useCallback(
    (volume: number) => {
      if (!gainNodeRef.current) return;

      gainNodeRef.current.gain.setValueAtTime(
        volume,
        state.audioContext?.currentTime || 0
      );

      dispatch({ type: "SET_VOLUME", payload: volume });
    },
    [state.audioContext]
  );

  // Handle page visibility changes with delayed suspension
  useEffect(() => {
    let suspensionTimeout: number;

    const handleVisibilityChange = async () => {
      if (!state.audioContext) return;

      if (document.hidden) {
        console.log("[WavePlayerProvider] Page hidden");
        if (sourceNodeRef.current && state.audioContext) {
          // Store current time before suspending
          pauseTimeRef.current =
            state.audioContext.currentTime - startTimeRef.current;

          // Fade out audio
          const fadeOutDuration = 0.05;
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.setValueAtTime(
              state.volume,
              state.audioContext.currentTime
            );
            gainNodeRef.current.gain.linearRampToValueAtTime(
              0,
              state.audioContext.currentTime + fadeOutDuration
            );
          }

          // Schedule cleanup after fade
          setTimeout(() => {
            if (sourceNodeRef.current) {
              sourceNodeRef.current.stop();
              sourceNodeRef.current.disconnect();
              sourceNodeRef.current = null;
            }
          }, fadeOutDuration * 1000);
        }

        // Only suspend after a delay of inactivity
        window.clearTimeout(suspensionTimeout);
        suspensionTimeout = window.setTimeout(async () => {
          if (
            state.status === "paused" &&
            state.audioContext?.state === "running"
          ) {
            console.log(
              "[WavePlayerProvider] Suspending audio context after inactivity"
            );
            await state.audioContext.suspend().catch(console.error);
          }
        }, 5000); // 5 second delay before suspension

        dispatch({ type: "SET_STATUS", payload: "paused" });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearTimeout(suspensionTimeout);
    };
  }, [state.audioContext, state.status, state.volume]);

  // Update time state
  useEffect(() => {
    let animationFrameId: number;

    const updateTime = () => {
      if (
        state.audioContext &&
        state.status === "playing" &&
        state.duration > 0
      ) {
        const rawCurrentTime =
          state.audioContext.currentTime - startTimeRef.current;

        // For looping tracks, calculate time within the loop cycle
        if (state.track?.isLoop) {
          const cycleTime = rawCurrentTime % state.duration;
          dispatch({ type: "SET_CURRENT_TIME", payload: cycleTime });
        } else {
          // For non-looping tracks, just use the raw time
          dispatch({ type: "SET_CURRENT_TIME", payload: rawCurrentTime });
        }
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };

    if (state.status === "playing") {
      updateTime();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [state.status, state.audioContext, state.duration, state.track]);

  // Update visualization state
  useEffect(() => {
    if (!analyserNodeRef.current || state.status !== "playing") return;

    const updateVisualization = () => {
      if (!analyserNodeRef.current) return;

      try {
        const visualizationBuffer = new Uint8Array(
          analyserNodeRef.current.frequencyBinCount
        );
        analyserNodeRef.current.getByteTimeDomainData(visualizationBuffer);
        const waveform = visualizationBuffer.slice();
        analyserNodeRef.current.getByteFrequencyData(visualizationBuffer);
        const frequencies = visualizationBuffer.slice();
        dispatch({
          type: "SET_VISUALIZATION",
          payload: { waveform, frequencies },
        });
        if (state.status === "playing") {
          requestAnimationFrame(updateVisualization);
        }
      } catch (error) {
        console.error(
          "[WavePlayerProvider] Visualization update error:",
          error
        );
      }
    };

    updateVisualization();
  }, [state.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioNodes();
      if (bufferPoolRef.current) {
        bufferPoolRef.current.cleanup();
        bufferPoolRef.current = null;
      }
      // Don't close the global context, just suspend it
      if (globalAudioContext && globalAudioContext.state !== "closed") {
        globalAudioContext.suspend().catch(console.error);
      }
    };
  }, [cleanupAudioNodes]);

  const value: WavePlayerContextValue = useMemo(
    () => ({
      state,
      controls: {
        play,
        pause,
        setVolume,
        seek,
        nextTrack,
        previousTrack,
        setLoop,
      },
      initialize,
      loadTrack,
      retryLoad,
      cleanup,
    }),
    [
      state,
      initialize,
      loadTrack,
      retryLoad,
      cleanup,
      play,
      pause,
      seek,
      nextTrack,
      previousTrack,
      setLoop,
      setVolume,
    ]
  );

  return (
    <WavePlayerContext.Provider value={value}>
      {children}
    </WavePlayerContext.Provider>
  );
}

export function useWavePlayerContext() {
  const context = useContext(WavePlayerContext);
  if (!context) {
    throw new Error(
      "useWavePlayerContext must be used within a WavePlayerProvider"
    );
  }
  return context;
}

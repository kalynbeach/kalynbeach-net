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

function playerReducer(
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
        currentTrackIndex: newTrack && state.playlist
          ? state.playlist.tracks.findIndex(t => t.id === newTrack.id)
          : 0
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

const WavePlayerContext = createContext<WavePlayerContextValue | null>(null);

export function WavePlayerProvider({
  children,
  playlist,
}: {
  children: React.ReactNode;
  playlist?: WavePlayerPlaylist;
}) {
  const [state, dispatch] = useReducer(playerReducer, {
    ...initialState,
    playlist: playlist || null,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const bufferPoolRef = useRef<WavePlayerBufferPool | null>(null);

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
      console.log(
        "[WavePlayerProvider resumeAudioContext] resuming audio context"
      );
      await state.audioContext.resume();
    }
  }, [state.audioContext]);

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

  const initializeAudioContext = useCallback(async () => {
    try {
      console.log(
        "[WavePlayerProvider initializeAudioContext] initializing audio context"
      );
      const audioContext = createAudioContext();
      if (!audioContext) {
        throw new Error("Audio context could not be created");
      }

      console.log(
        "[WavePlayerProvider initializeAudioContext] resuming audio context"
      );
      await resumeAudioContext();

      // Initialize audio nodes
      analyserNodeRef.current = audioContext.createAnalyser();
      gainNodeRef.current = audioContext.createGain();

      // Connect node chain
      gainNodeRef.current.connect(audioContext.destination);
      analyserNodeRef.current.connect(gainNodeRef.current);

      // Initialize buffer pool
      bufferPoolRef.current = new WavePlayerBufferPool({
        onProgress: (progress) => {
          dispatch({ type: "SET_PROGRESS", payload: progress });
        },
        onError: (error) => {
          dispatch({ type: "SET_ERROR", payload: error });
        },
      });

      dispatch({ type: "INITIALIZE", payload: { audioContext } });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload:
          error instanceof Error
            ? error
            : new Error("Audio context initialization failed"),
      });
    }
  }, []);

  const play = useCallback(async () => {
    if (!state.audioContext || !state.buffer || !state.track) return;

    console.log("[WavePlayerProvider play] playing track...");

    try {
      // Resume context if suspended
      if (state.audioContext.state === "suspended") {
        console.log("[WavePlayerProvider play] resuming audio context");
        await state.audioContext.resume();
        
        // When resuming from pause, use the stored pause time
        startTimeRef.current = state.audioContext.currentTime - pauseTimeRef.current;
      } else {
        // Create new source node
        sourceNodeRef.current = state.audioContext.createBufferSource();
        sourceNodeRef.current.buffer = state.buffer;
        sourceNodeRef.current.connect(analyserNodeRef.current!);

        // Set loop property directly on the source node if track is a loop
        sourceNodeRef.current.loop = state.track.isLoop;

        // Handle track completion for non-looping tracks
        if (!state.track.isLoop) {
          sourceNodeRef.current.onended = () => {
            console.log("[WavePlayerProvider play] track ended");
            // Stop playback and reset time
            sourceNodeRef.current?.disconnect();
            sourceNodeRef.current = null;
            startTimeRef.current = 0;
            pauseTimeRef.current = 0;
            dispatch({ type: "SET_STATUS", payload: "ready" });
            dispatch({ type: "SET_CURRENT_TIME", payload: 0 });
          };
        }

        // Start playback
        const startTime = state.audioContext.currentTime - (pauseTimeRef.current || 0);
        sourceNodeRef.current.start(0, pauseTimeRef.current);
        startTimeRef.current = startTime;
      }

      dispatch({ type: "SET_STATUS", payload: "playing" });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error : new Error("Playback failed"),
      });
    }
  }, [state.audioContext, state.buffer, state.track]);

  const pause = useCallback(() => {
    if (!state.audioContext || !sourceNodeRef.current) return;

    // Store the current time before pausing
    pauseTimeRef.current = state.audioContext.currentTime - startTimeRef.current;
    
    // Suspend the audio context instead of stopping the source
    state.audioContext.suspend();
    dispatch({ type: "SET_STATUS", payload: "paused" });
  }, [state.audioContext]);

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
    if (sourceNodeRef.current) {
      console.log(
        "[WavePlayerProvider cleanupBuffer] disconnecting source node"
      );
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (bufferPoolRef.current) {
      bufferPoolRef.current.cleanup();
    }
    dispatch({ type: "SET_BUFFER", payload: null });
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const updateTime = () => {
      if (state.audioContext && state.status === "playing" && state.duration > 0) {
        const rawCurrentTime = state.audioContext.currentTime - startTimeRef.current;
        
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

  useEffect(() => {
    if (!analyserNodeRef.current || state.status !== "playing") return;

    const updateVisualization = () => {
      const visualizationBuffer = new Uint8Array(
        analyserNodeRef.current!.frequencyBinCount
      );
      analyserNodeRef.current!.getByteTimeDomainData(visualizationBuffer);
      const waveform = visualizationBuffer.slice();
      analyserNodeRef.current!.getByteFrequencyData(visualizationBuffer);
      const frequencies = visualizationBuffer.slice();

      dispatch({
        type: "SET_VISUALIZATION",
        payload: { waveform, frequencies },
      });

      if (state.status === "playing") {
        requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }, [state.status]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const value: WavePlayerContextValue = useMemo(
    () => ({
      state,
      controls: {
        play,
        pause,
        setVolume,
        seek,
        nextTrack: () => {
          if (!state.playlist) return;
          const nextIndex = (state.currentTrackIndex + 1) % state.playlist.tracks.length;
          const nextTrack = state.playlist.tracks[nextIndex];
          dispatch({ type: "SET_TRACK", payload: nextTrack });
          loadTrack(nextTrack);
        },
        previousTrack: () => {
          if (!state.playlist) return;
          const prevIndex = state.currentTrackIndex === 0 
            ? state.playlist.tracks.length - 1 
            : state.currentTrackIndex - 1;
          const prevTrack = state.playlist.tracks[prevIndex];
          dispatch({ type: "SET_TRACK", payload: prevTrack });
          loadTrack(prevTrack);
        },
        setLoop: (loop: boolean) => {
          dispatch({ type: "SET_LOOP", payload: loop });
        },
      },
      loadTrack,
      initializeAudioContext,
      retryLoad,
      cleanup,
    }),
    [
      state,
      play,
      pause,
      setVolume,
      seek,
      loadTrack,
      initializeAudioContext,
      retryLoad,
      cleanup,
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

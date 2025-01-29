"use client";

import { useEffect, useState, useRef } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import type {
  WavePlayerState,
  WavePlayerStatus,
  WavePlayerTrack,
  WavePlayerPlaylist,
  WavePlayerControls,
} from "@/lib/types";

export type UseWavePlayerValue = WavePlayerState & {
  controls: WavePlayerControls;
};

export function useWavePlayer(playlist: WavePlayerPlaylist): UseWavePlayerValue {
  const { state, controls, initialize, cleanup } = useWavePlayerContext();
  // TODO: refactor `state` out of `WavePlayerContextProvider` and into `useWavePlayer` state
  // const [status, setStatus] = useState<WavePlayerStatus>("idle");
  // const [track, setTrack] = useState<WavePlayerTrack | null>(null);
  // const [currentTime, setCurrentTime] = useState<number>(0);
  // const [duration, setDuration] = useState<number>(0);
  // const [volume, setVolume] = useState<number>(1);
  // const [isMuted, setIsMuted] = useState<boolean>(false);
  // const [isLooping, setIsLooping] = useState<boolean>(false);
  // const [error, setError] = useState<Error | null>(null);

  // initialize player and ensure initial track
  useEffect(() => {
    let mounted = true;

    async function initializePlayer() {
      try {
        await initialize(playlist);
        if (mounted && !state.track) {
          await controls.next();
        }
      } catch (error) {
        console.error("Failed to initialize player:", error);
      }
    }

    initializePlayer();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [playlist, state.track, controls, initialize, cleanup]);

  return {
    ...state,
    controls
  };
}
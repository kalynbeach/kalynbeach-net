import { useEffect, useState, useRef } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import type {
  WavePlayerControls,
  WavePlayerState,
  WavePlayerTrack,
  WavePlayerPlaylist,
} from "@/lib/types";

export type UseWavePlayerValue = WavePlayerState & {
  controls: WavePlayerControls;
};

export function useWavePlayer(playlist: WavePlayerPlaylist): UseWavePlayerValue {
  const { state, controls, initialize, cleanup } = useWavePlayerContext();
  const audioRef = useRef<HTMLAudioElement>(null);

  console.log("[useWavePlayer] state", state);

  // initialize player and ensure initial track
  useEffect(() => {
    let mounted = true;

    async function initializePlayer() {
      // console.log("[useWavePlayer initializePlayer] initializing");
      try {
        await initialize(playlist);
        // console.log("[useWavePlayer initializePlayer] initialized");
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
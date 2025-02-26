"use client";

import { useEffect, useState } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";

export function useWavePlayer() {
  const { state, controls, initialize, loadTrack, retryLoad } = useWavePlayerContext();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize the audio context once
  useEffect(() => {
    if (!hasInitialized && state.status === "idle") {
      console.log("[useWavePlayer] initializing audio context");
      initialize().then(() => {
        setHasInitialized(true);
      }).catch(error => {
        console.error("[useWavePlayer] Error initializing:", error);
      });
    }
  }, [initialize, state.status, hasInitialized]);

  // Load initial track when playlist changes and we're initialized
  useEffect(() => {
    const playlist = state.playlist;
    if (!playlist || playlist.tracks.length === 0 || !hasInitialized) return;

    // Only load track if we're not already loading or playing
    if (state.status === "idle" || state.status === "error") {
      console.log("[useWavePlayer] Loading initial track");
      loadTrack(playlist.tracks[state.currentTrackIndex]);
    }
  }, [state.playlist, state.currentTrackIndex, state.status, loadTrack, hasInitialized]);

  return {
    state,
    controls,
    initialize,
    loadTrack,
    retryLoad,
  };
}



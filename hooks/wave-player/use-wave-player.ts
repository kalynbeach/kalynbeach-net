"use client";

import { useEffect } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";

export function useWavePlayer() {
  const { state, controls, initialize, loadTrack, retryLoad } = useWavePlayerContext();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load initial track when playlist changes or currentTrackIndex changes
  useEffect(() => {
    const playlist = state.playlist;
    if (!playlist || playlist.tracks.length === 0) return;

    // Only load track if we're not already loading or playing
    if (state.status === "idle" || state.status === "error") {
      loadTrack(playlist.tracks[state.currentTrackIndex]);
    }
  }, [state.playlist, state.currentTrackIndex, state.status, loadTrack]);

  return {
    state,
    controls,
    initialize,
    loadTrack,
    retryLoad,
  };
}



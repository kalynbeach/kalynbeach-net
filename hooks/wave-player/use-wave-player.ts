"use client";

import { useEffect } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";

export function useWavePlayer() {
  const { state, controls, initialize, loadTrack, retryLoad } = useWavePlayerContext();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const playlist = state.playlist;
    if (!playlist) return;

    if (playlist.tracks.length > 0) {
      loadTrack(playlist.tracks[state.currentTrackIndex]);

      // Preload next track if available
      const nextTrackIndex = (state.currentTrackIndex + 1) % playlist.tracks.length;
      if (nextTrackIndex !== state.currentTrackIndex) {
        const nextTrack = playlist.tracks[nextTrackIndex];
        // NOTE: preloading is handled internally by the buffer pool
        loadTrack(nextTrack);
      }
    }
  }, [state.playlist, state.currentTrackIndex, loadTrack]);

  return {
    state,
    controls,
    initialize,
    loadTrack,
    retryLoad,
  };
}



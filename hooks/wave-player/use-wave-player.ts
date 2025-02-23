"use client";

import { useEffect, useState } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";

// TODO: review implementation and refactor as needed
export function useWavePlayer(playlist: WavePlayerPlaylist) {
  const { state, controls, initialize, loadTrack, retryLoad } = useWavePlayerContext();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
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
  }, [playlist, state.currentTrackIndex, loadTrack]);

  return {
    state,
    controls,
    initialize,
    loadTrack,
    retryLoad,
  };
}



"use client";

import { useEffect, useState } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";

export function useWavePlayer(playlist: WavePlayerPlaylist) {
  const { state, controls, initializeAudioContext, loadTrack, retryLoad } = useWavePlayerContext();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  useEffect(() => {
    initializeAudioContext();
  }, [initializeAudioContext]);

  useEffect(() => {
    if (playlist.tracks.length > 0) {
      loadTrack(playlist.tracks[currentTrackIndex]);

      // Preload next track if available
      const nextTrackIndex = (currentTrackIndex + 1) % playlist.tracks.length;
      if (nextTrackIndex !== currentTrackIndex) {
        const nextTrack = playlist.tracks[nextTrackIndex];
        // NOTE: preloading is handled internally by the buffer pool
        loadTrack(nextTrack);
      }
    }
  }, [playlist, currentTrackIndex, loadTrack]);

  const nextTrack = () => {
    if (playlist.tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.tracks.length);
    }
  };

  const previousTrack = () => {
    if (playlist.tracks.length > 0) {
      setCurrentTrackIndex((prev) => 
        prev === 0 ? playlist.tracks.length - 1 : prev - 1
      );
    }
  };

  return {
    state,
    controls: {
      ...controls,
      nextTrack,
      previousTrack,
    },
    currentTrackIndex,
    initializeAudioContext,
    loadTrack,
    retryLoad,
  };
}



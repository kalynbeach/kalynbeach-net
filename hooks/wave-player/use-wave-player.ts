"use client";

import { useEffect } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player/context";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";

export function useWavePlayer(playlist: WavePlayerPlaylist) {
  const { state, controls, initializeAudioContext, loadTrack } = useWavePlayerContext();

  useEffect(() => {
    initializeAudioContext();
  }, [initializeAudioContext]);

  useEffect(() => {
    if (playlist.tracks.length > 0) {
      loadTrack(playlist.tracks[0]);
    }
  }, [playlist, loadTrack]);

  return {
    state,
    controls,
    initializeAudioContext,
    loadTrack,
  };
}


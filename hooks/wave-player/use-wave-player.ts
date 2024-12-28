import { useEffect, useState, useRef } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import type { WavePlayerTrack, WavePlayerState, WavePlayerControls } from "@/lib/types";

export type UseWavePlayerReturn = {
  state: WavePlayerState;
  controls: WavePlayerControls;
  analyserData: {
    frequencyData: Uint8Array | null;
    timeDomainData: Uint8Array | null;
  };
};

export function useWavePlayer(tracks: WavePlayerTrack[]): UseWavePlayerReturn {
  if (tracks.length === 0) {
    throw new Error("useWavePlayer requires at least one track");
  }

  const {
    state,
    controls,
    analyserNode,
    initialize,
    cleanup,
  } = useWavePlayerContext();

  const [analyserData, setAnalyserData] = useState<UseWavePlayerReturn["analyserData"]>({
    frequencyData: null,
    timeDomainData: null,
  });

  const timeUpdateRef = useRef<number>(0);

  // Initialize player and ensure initial track
  useEffect(() => {
    let mounted = true;

    async function initializePlayer() {
      try {
        await initialize();
        
        // Ensure we have a current track
        if (mounted && !state.currentTrack) {
          controls.next(); // Use existing controls to set initial track
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
  }, [initialize, cleanup, tracks, state.currentTrack, controls]);

  // Update analyser data for visualizations
  useEffect(() => {
    if (!analyserNode || state.status !== "playing") {
      return;
    }

    let animationFrameId: number;
    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    const timeDomainData = new Uint8Array(analyserNode.frequencyBinCount);

    function updateAnalyserData() {
      if (!analyserNode) return;
      
      analyserNode.getByteFrequencyData(frequencyData);
      analyserNode.getByteTimeDomainData(timeDomainData);
      
      setAnalyserData({
        frequencyData: new Uint8Array(frequencyData),
        timeDomainData: new Uint8Array(timeDomainData),
      });

      animationFrameId = requestAnimationFrame(updateAnalyserData);
    }

    updateAnalyserData();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [analyserNode, state.status]);

  // Track current time update
  useEffect(() => {
    if (state.status !== "playing") {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
      return;
    }

    timeUpdateRef.current = window.setInterval(() => {
      const newTime = Math.min(state.currentTime + 0.1, state.duration);
      if (newTime !== state.currentTime) {
        controls.seek(newTime);
      }
    }, 100);

    return () => {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
        timeUpdateRef.current = 0;
      }
    };
  }, [state.status]);

  return {
    state,
    controls,
    analyserData,
  };
}
"use client";

import { useEffect, useRef, useState } from "react";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import WavePlayerTrackInfo from "./wave-player-track-info";
import WavePlayerTrackVisual from "./wave-player-track-visual";
import WavePlayerTrackControls from "./wave-player-track-controls";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// TODO: create a WavePlayerSkeleton component

type WavePlayerProps = {
  playlist: WavePlayerPlaylist;
};

export default function WavePlayer({ playlist }: WavePlayerProps) {
  const { state, initializeAudioContext, retryLoad } = useWavePlayer(playlist);
  const [needsActivation, setNeedsActivation] = useState(true);

  // TODO: review if this useEffect is needed - it feels like
  // it's redundant or should be handled in the useWavePlayer hook
  useEffect(() => {
    if (needsActivation && state.status === "idle") {
      console.log("[WavePlayer] initializing audio context");
      initializeAudioContext();
      setNeedsActivation(false);
    }
  }, [state.status, needsActivation]);

  // TODO: refactor and clean up error UI
  if (state.error) {
    return (
      <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border ">
        <CardHeader className="p-4"></CardHeader>
        <CardContent className="p-4 flex flex-col items-center gap-4">
          <div className="text-red-500 font-mono">Error: {state.error.message}</div>
          <Button onClick={() => retryLoad()}>
            Retry
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center p-4"></CardFooter>
      </Card>
    );
  }

  // TODO: refactor and clean up loading UI (use skeleton)
  if (!state.track || state.status === "loading") {
    return (
      <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border border-primary rounded-none">
        <CardHeader className="p-4"></CardHeader>
        <CardContent className="w-full h-full flex flex-col items-center justify-center p-4 gap-2">
          <div className="h-4 w-full bg-secondary relative">
            <div 
              className="absolute h-full bg-primary" 
              style={{ width: `${state.bufferProgress}%` }}
            />
          </div>
          <p className="text-sm font-mono">loading...</p>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center p-4"></CardFooter>
      </Card>
    );
  }

  return (
    <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border rounded-none">
      <CardHeader className="w-full p-2">
        <WavePlayerTrackInfo track={state.track} />
      </CardHeader>
      <CardContent className="w-full h-full flex flex-col items-center justify-center px-2 py-0">
        <WavePlayerTrackVisual image={state.track.image} />
      </CardContent>
      <CardFooter className="w-full flex flex-col items-center justify-center p-2">
        <WavePlayerTrackControls />
      </CardFooter>
    </Card>
  );
}
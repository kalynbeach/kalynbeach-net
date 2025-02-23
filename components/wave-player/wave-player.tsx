"use client";

import { useEffect, useState } from "react";
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

export default function WavePlayer() {
  const { state, initialize, retryLoad, controls } = useWavePlayer();
  const [needsActivation, setNeedsActivation] = useState(true);

  useEffect(() => {
    if (needsActivation && state.status === "idle") {
      console.log("[WavePlayer] initializing audio context");
      initialize();
      setNeedsActivation(false);
    }
  }, [state.status, needsActivation, initialize]);

  // TODO: refactor and clean up error UI
  if (state.error) {
    return (
      <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border">
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
        <WavePlayerTrackVisual
          image={state.track.image}
          visualization={state.visualization}
        />
      </CardContent>
      <CardFooter className="w-full flex flex-col items-center justify-center p-2">
        <WavePlayerTrackControls
          status={state.status}
          currentTime={state.currentTime}
          duration={state.duration}
          controls={controls}
        />
      </CardFooter>
    </Card>
  );
}
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

type WavePlayerProps = {
  playlist: WavePlayerPlaylist;
};

export default function WavePlayer({ playlist }: WavePlayerProps) {
  const { state, initializeAudioContext, retryLoad } = useWavePlayer(playlist);
  const [needsActivation, setNeedsActivation] = useState(true);

  useEffect(() => {
    if (needsActivation && state.status === "idle") {
      initializeAudioContext();
      setNeedsActivation(false);
    }
  }, [state.status, needsActivation]);

  // if (needsActivation) {
  //   return (
  //     <Card className="wave-player wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border border-primary rounded-none">
  //       <CardHeader className="p-4"></CardHeader>
  //       <CardContent className="p-4 text-center">
  //         <Button 
  //           onClick={async () => {
  //             await initializeAudioContext();
  //             setNeedsActivation(false);
  //           }}
  //         >
  //           Activate Audio
  //         </Button>
  //       </CardContent>
  //       <CardFooter className="flex flex-col items-center justify-center p-4"></CardFooter>
  //     </Card>
  //   );
  // }

  if (state.error) {
    return (
      <Card className="wave-player wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border border-primary rounded-none">
        <CardHeader className="p-4"></CardHeader>
        <CardContent className="p-4 flex flex-col items-center gap-4">
          <div className="text-red-500">Error: {state.error.message}</div>
          <Button onClick={() => retryLoad()}>
            Retry
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center p-4"></CardFooter>
      </Card>
    );
  }

  if (!state.track || state.status === "loading") {
    return (
      <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border border-primary rounded-none">
        <CardHeader className="p-4"></CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
          <div className="h-4 w-full bg-secondary relative">
            <div 
              className="absolute h-full bg-primary" 
              style={{ width: `${state.bufferProgress}%` }}
            />
          </div>
          <p className="text-sm">Loading track...</p>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center p-4"></CardFooter>
      </Card>
    );
  }

  return (
    <Card className="wave-player aspect-[5/7] w-full sm:w-[320px] md:w-[360px] flex flex-col border border-primary rounded-none">
      <CardHeader className="w-full p-4">
        <WavePlayerTrackInfo track={state.track} />
      </CardHeader>
      <CardContent className="w-full h-full flex flex-col items-center justify-center p-4">
        <WavePlayerTrackVisual image={state.track.image} />
      </CardContent>
      <CardFooter className="w-full flex flex-col items-center justify-center p-4">
        <WavePlayerTrackControls />
        {/* <WavePlayerTrackControls
          status={state.status}
          currentTime={state.currentTime}
          duration={state.duration}
          volume={state.volume}
          controls={controls}
        /> */}
      </CardFooter>
    </Card>
  );
}
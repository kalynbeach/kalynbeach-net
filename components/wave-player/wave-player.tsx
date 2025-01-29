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
  const { state, initializeAudioContext } = useWavePlayer(playlist);
  // const [needsActivation, setNeedsActivation] = useState(true);

  useEffect(() => {
    if (state.status === "idle") {
      initializeAudioContext();
      // setNeedsActivation(true);
    }
  }, [state.status]);

  // if (needsActivation) {
  //   return (
  //     <Card className="wave-player">
  //       <CardContent className="p-4 text-center">
  //         <Button 
  //           onClick={() => {
  //             initializeAudioContext();
  //             setNeedsActivation(false);
  //           }}
  //         >
  //           initialize
  //         </Button>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  if (state.error) {
    return (
      <Card className="wave-player">
        <CardContent className="text-red-500 p-4">
          Error: {state.error.message}
        </CardContent>
      </Card>
    );
  }

  if (!state.track || state.status === "loading") {
    return (
      <Card className="wave-player">
        <CardContent className="flex items-center justify-center p-4">
          <p className="text-sm font-mono">loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wave-player aspect-[5/7] w-full md:w-[320px] lg:w-[360px] flex flex-col border border-primary rounded-none">
      <CardHeader className="p-4">
        <WavePlayerTrackInfo track={state.track} />
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-4">
        <WavePlayerTrackVisual image={state.track.image} />
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center p-4">
        <WavePlayerTrackControls />
      </CardFooter>
    </Card>
  );
}
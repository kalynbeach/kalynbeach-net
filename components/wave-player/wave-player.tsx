"use client";

import { useEffect, useRef } from "react";
import type { WavePlayerPlaylist } from "@/lib/types";
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

type WavePlayerProps = {
  playlist: WavePlayerPlaylist;
};

export default function WavePlayer({ playlist }: WavePlayerProps) {
  const { track, status, currentTime, duration, controls } = useWavePlayer(playlist);

  if (!track) {
    console.log("[WavePlayer] track is null");
    return null;
  }

  return (
    <Card className="wave-player aspect-[5/7] w-full md:w-[320px] lg:w-[360px] flex flex-col border border-primary rounded-none">
      <CardHeader className="p-4">
        {/* TODO: implement audio element (integrated with WavePlayerContext via `audioRef`) */}
        {/* <audio
          ref={audioRef}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onPlay={() => controls.play()}
          onPause={() => controls.pause()}
          onEnded={() => controls.stop()}
        /> */}
        <WavePlayerTrackInfo track={track} />
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-4">
        <WavePlayerTrackVisual image={track.image} />
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center p-4">
        <WavePlayerTrackControls
          controls={controls}
          status={status}
          currentTime={currentTime}
          duration={duration}
        />
      </CardFooter>
    </Card>
  );
}
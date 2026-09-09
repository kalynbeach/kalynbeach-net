"use client";

import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import WavePlayerTrackInfo from "./wave-player-track-info";
import WavePlayerTrackVisual from "./wave-player-track-visual";
import WavePlayerTrackControls from "./wave-player-track-controls";
import WavePlayerSkeleton from "./wave-player-skeleton";
import WavePlayerError from "./wave-player-error";
import WavePlayerLoading from "./wave-player-loading";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function WavePlayer() {
  const { state, retryLoad, controls } = useWavePlayer();

  if (state.error) {
    return (
      <WavePlayerError
        error={state.error}
        track={state.track}
        onRetry={retryLoad}
      />
    );
  }

  if (!state.audioContext || !state.playlist) {
    return <WavePlayerSkeleton />;
  }

  if (!state.track || state.status === "loading") {
    return (
      <WavePlayerLoading
        track={state.track}
        status={state.status}
        bufferProgress={state.bufferProgress}
        currentTime={state.currentTime}
        duration={state.duration}
        controls={controls}
        isLooping={state.isLooping}
      />
    );
  }

  return (
    <Card className="wave-player bg-background flex aspect-[5/7] w-[380px] flex-col rounded-none border">
      <CardHeader className="w-full p-2">
        <WavePlayerTrackInfo track={state.track} />
      </CardHeader>
      <CardContent className="flex h-full w-full flex-col items-center justify-center px-2 py-0">
        <WavePlayerTrackVisual
          image={state.track.image}
          visualization={state.visualization}
        />
      </CardContent>
      <CardFooter className="flex w-full flex-col items-center justify-center p-2">
        <WavePlayerTrackControls
          status={state.status}
          currentTime={state.currentTime}
          duration={state.duration}
          controls={controls}
          isLooping={state.isLooping}
        />
      </CardFooter>
    </Card>
  );
}

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
  
  // Handle error state with improved error UI
  if (state.error) {
    return <WavePlayerError error={state.error} track={state.track} onRetry={retryLoad} />;
  }

  // Handle initial loading state with skeleton
  if (!state.audioContext || !state.playlist) {
    return <WavePlayerSkeleton />;
  }

  // Handle track loading state with progress indicator
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

  // Render the fully loaded player
  return (
    <Card className="wave-player aspect-[5/7] w-[380px] flex flex-col border rounded-none">
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
          isLooping={state.isLooping}
        />
      </CardFooter>
    </Card>
  );
}
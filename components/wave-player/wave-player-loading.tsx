import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type {
  WavePlayerTrack,
  WavePlayerControls,
  WavePlayerStatus,
} from "@/lib/types/wave-player";
import WavePlayerTrackInfo from "./wave-player-track-info";
import WavePlayerTrackControls from "./wave-player-track-controls";
import { Loader2 } from "lucide-react";

interface WavePlayerLoadingProps {
  track: WavePlayerTrack | null;
  status: WavePlayerStatus;
  bufferProgress: number;
  currentTime: number;
  duration: number;
  controls: WavePlayerControls;
  isLooping: boolean;
}

/**
 * Loading state component for WavePlayer when we have partial track information
 * Shows loading progress and maintains consistent layout
 */
export default function WavePlayerLoading({
  track,
  status,
  bufferProgress,
  currentTime,
  duration,
  controls,
  isLooping,
}: WavePlayerLoadingProps) {
  return (
    <Card className="wave-player bg-background flex aspect-[5/7] w-[380px] flex-col rounded-none border">
      <CardHeader className="w-full p-2">
        {track ? (
          <WavePlayerTrackInfo track={track} />
        ) : (
          <div className="wave-player-track-info border-muted/50 flex h-full w-full flex-col gap-1 border p-2">
            <div className="bg-muted/50 h-6 w-3/4 animate-pulse rounded-sm" />
            <div className="mt-1 space-y-2">
              <div className="bg-muted/40 h-4 w-1/2 animate-pulse rounded-sm" />
              <div className="bg-muted/30 h-4 w-1/3 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex h-full w-full flex-col items-center justify-center px-2 py-0">
        <div className="wave-player-track-visual relative w-full">
          <div className="border-muted bg-background/5 flex size-[362px] flex-col items-center justify-center gap-8 border">
            {/* <Loader2 className="h-10 w-10 text-muted-foreground/60 animate-spin" /> */}

            <div className="w-4/5 space-y-2">
              <div className="bg-background/30 h-2 w-full rounded-full">
                <div
                  className="bg-primary/70 h-full rounded-full transition-all"
                  style={{ width: `${bufferProgress}%` }}
                />
              </div>
              {/* <div className="w-full flex justify-between items-center">
                <p className="text-xs text-muted-foreground">{bufferProgress.toFixed(0)}%</p>
                <p className="text-xs font-mono">
                  {track ? "Loading track..." : "Initializing..."}
                </p>
              </div> */}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-col items-center justify-center p-2">
        {track ? (
          <WavePlayerTrackControls
            status={status}
            currentTime={currentTime}
            duration={duration}
            controls={controls}
            isLooping={isLooping}
          />
        ) : (
          <div className="wave-player-track-controls border-muted/50 relative flex w-full flex-col items-center justify-center gap-2 border p-4">
            <div className="flex w-full flex-col items-center justify-center space-y-2 px-2 opacity-50">
              <div className="bg-muted/40 h-3 w-full rounded-full" />
              <div className="flex w-full flex-row justify-between text-sm">
                <div className="bg-muted/40 h-4 w-10 animate-pulse rounded-sm" />
                <div className="bg-muted/40 h-4 w-10 animate-pulse rounded-sm" />
              </div>
            </div>
            <div className="flex w-full items-center justify-center gap-4 opacity-50">
              <div className="bg-muted/40 h-8 w-8 animate-pulse rounded-full" />
              <div className="bg-muted/50 h-10 w-10 animate-pulse rounded-full" />
              <div className="bg-muted/40 h-8 w-8 animate-pulse rounded-full" />
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

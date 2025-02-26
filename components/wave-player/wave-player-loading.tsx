import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type { WavePlayerTrack, WavePlayerControls, WavePlayerStatus } from "@/lib/types/wave-player";
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
  isLooping
}: WavePlayerLoadingProps) {
  return (
    <Card className="wave-player aspect-[5/7] w-[380px] flex flex-col border rounded-none bg-background">
      <CardHeader className="w-full p-2">
        {track ? (
          <WavePlayerTrackInfo track={track} />
        ) : (
          <div className="wave-player-track-info w-full h-full flex flex-col gap-1 border border-muted/50 p-2">
            <div className="h-6 w-3/4 bg-muted/50 animate-pulse rounded-sm" />
            <div className="space-y-2 mt-1">
              <div className="h-4 w-1/2 bg-muted/40 animate-pulse rounded-sm" />
              <div className="h-4 w-1/3 bg-muted/30 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="w-full h-full flex flex-col items-center justify-center px-2 py-0">
        <div className="wave-player-track-visual relative w-full">
          <div className="size-[362px] border border-muted flex flex-col items-center justify-center bg-background/5 gap-8">
            {/* <Loader2 className="h-10 w-10 text-muted-foreground/60 animate-spin" /> */}
            
            <div className="w-4/5 space-y-2">
              <div className="w-full h-2 bg-background/30 rounded-full">
                <div 
                  className="h-full bg-primary/70 rounded-full transition-all" 
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
      <CardFooter className="w-full flex flex-col items-center justify-center p-2">
        {track ? (
          <WavePlayerTrackControls
            status={status}
            currentTime={currentTime}
            duration={duration}
            controls={controls}
            isLooping={isLooping}
          />
        ) : (
          <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4 relative">
            <div className="w-full space-y-2 flex flex-col items-center justify-center px-2 opacity-50">
              <div className="w-full h-3 bg-muted/40 rounded-full" />
              <div className="w-full flex flex-row justify-between text-sm">
                <div className="h-4 w-10 bg-muted/40 animate-pulse rounded-sm" />
                <div className="h-4 w-10 bg-muted/40 animate-pulse rounded-sm" />
              </div>
            </div>
            <div className="w-full flex items-center justify-center gap-4 opacity-50">
              <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 
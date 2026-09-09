import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { WavePlayerTrack } from "@/lib/types/wave-player";
import WavePlayerTrackInfo from "./wave-player-track-info";

interface WavePlayerErrorProps {
  error: Error;
  track: WavePlayerTrack | null;
  onRetry: () => void;
}

/**
 * Error display component for WavePlayer
 * Maintains consistent layout and styling with main player
 */
export default function WavePlayerError({
  error,
  track,
  onRetry,
}: WavePlayerErrorProps) {
  return (
    <Card className="wave-player flex aspect-[5/7] w-[380px] flex-col rounded-none border">
      <CardHeader className="w-full p-2">
        {track ? (
          <WavePlayerTrackInfo track={track} />
        ) : (
          <div className="wave-player-track-info border-muted/50 flex h-full w-full flex-col gap-1 border p-2">
            <p className="font-mono text-lg text-red-500/90">Error</p>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex h-full w-full flex-col items-center justify-center gap-6 px-2 py-4">
        <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-red-500/30 p-8">
          <AlertTriangle className="h-12 w-12 text-red-500/80" />
          <div className="space-y-2 text-center">
            <p className="font-medium text-red-500">Audio Playback Error</p>
            <p className="text-muted-foreground max-w-[300px] font-mono text-sm break-all">
              {error.message || "Failed to load audio"}
            </p>
          </div>
          <Button
            onClick={onRetry}
            variant="outline"
            className="mt-2 border-red-500/50 hover:bg-red-500/10 hover:text-red-500"
          >
            Retry
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-col items-center justify-center p-2">
        <div className="wave-player-track-controls border-muted/50 relative flex w-full flex-col items-center justify-center gap-2 border p-4">
          <p className="text-muted-foreground text-xs">
            Try refreshing the page if the error persists
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}

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
export default function WavePlayerError({ error, track, onRetry }: WavePlayerErrorProps) {
  return (
    <Card className="wave-player aspect-[5/7] w-[380px] flex flex-col border rounded-none">
      <CardHeader className="w-full p-2">
        {track ? (
          <WavePlayerTrackInfo track={track} />
        ) : (
          <div className="wave-player-track-info w-full h-full flex flex-col gap-1 border border-muted/50 p-2">
            <p className="font-mono text-lg text-red-500/90">Error</p>
          </div>
        )}
      </CardHeader>
      <CardContent className="w-full h-full flex flex-col items-center justify-center px-2 py-4 gap-6">
        <div className="flex flex-col items-center justify-center gap-4 p-8 border border-red-500/30 rounded-md">
          <AlertTriangle className="h-12 w-12 text-red-500/80" />
          <div className="text-center space-y-2">
            <p className="font-medium text-red-500">Audio Playback Error</p>
            <p className="text-sm text-muted-foreground font-mono break-all max-w-[300px]">
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
      <CardFooter className="w-full flex flex-col items-center justify-center p-2">
        <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4 relative">
          <p className="text-xs text-muted-foreground">
            Try refreshing the page if the error persists
          </p>
        </div>
      </CardFooter>
    </Card>
  );
} 
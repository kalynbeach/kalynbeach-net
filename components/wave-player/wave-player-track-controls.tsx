"use client";

import { formatTime } from "@/lib/utils";
import type { WavePlayerState, WavePlayerControls } from "@/lib/types/wave-player";
// import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Repeat,
} from "lucide-react";

type WavePlayerTrackControlsProps = {
  status: WavePlayerState["status"];
  currentTime: WavePlayerState["currentTime"];
  duration: WavePlayerState["duration"];
  controls: WavePlayerControls;
  isLooping?: boolean;
};

export default function WavePlayerTrackControls({ 
  status, 
  currentTime, 
  duration, 
  controls,
  isLooping = false 
}: WavePlayerTrackControlsProps) {
  // const { state, controls } = useWavePlayer();
  const isLoading = status === "loading";

  return (
    <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4 relative">
      {/* Progress Slider */}
      <div className="w-full space-y-2 flex flex-col items-center justify-center px-2">
        <Slider
          value={[currentTime]}
          max={duration}
          onValueChange={([value]) => controls.seek(value)}
          disabled={isLoading}
          className="w-full"
        />
        <div className="w-full flex flex-row justify-between text-sm">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="w-full flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={controls.previousTrack}
          disabled={isLoading}
          className="hover:bg-secondary"
        >
          <SkipBack className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => status === "playing" ? controls.pause() : controls.play()}
          disabled={isLoading}
          className="h-10 w-10"
        >
          {status === "playing" ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={controls.nextTrack}
          disabled={isLoading}
          className="hover:bg-secondary"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      {/* Loop Control */}
      {/* <div className="absolute top-2 right-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => controls.setLoop(!isLooping)}
          disabled={isLoading}
          className={`h-8 w-8 ${isLooping ? 'bg-secondary' : ''}`}
        >
          <Repeat className="h-4 w-4" />
        </Button>
      </div> */}

      {/* Loading Overlay */}
      {/* {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )} */}

      {/* Volume Control */}
      {/* <div className="w-full flex items-center justify-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[state.volume * 100]}
          max={100}
          onValueChange={([value]) => controls.setVolume(value / 100)}
          className="w-24"
        />
      </div> */}
    </div>
  );
}

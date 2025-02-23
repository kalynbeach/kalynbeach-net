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
};

export default function WavePlayerTrackControls({ status, currentTime, duration, controls }: WavePlayerTrackControlsProps) {
  // const { state, controls } = useWavePlayer();

  return (
    <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4">
      {/* Progress Slider */}
      <div className="w-full space-y-2 flex flex-col items-center justify-center px-2">
        <Slider
          value={[currentTime]}
          max={duration}
          onValueChange={([value]) => controls.seek(value)}
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
          className="hover:bg-secondary"
        >
          <SkipBack className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => status === "playing" ? controls.pause() : controls.play()}
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
          className="hover:bg-secondary"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

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

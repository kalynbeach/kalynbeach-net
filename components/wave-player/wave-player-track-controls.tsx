"use client";

// import type { WavePlayerStatus, WavePlayerControls } from "@/lib/types/wave-player";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import { formatTime } from "@/lib/utils";
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

// TODO: figure out if it's better to use state and controls from props instead of useWavePlayerContext
// type WavePlayerTrackControlsProps = {
//   status: WavePlayerStatus;
//   state.currentTime: number;
//   duration: number;
//   volume: number;
//   controls: WavePlayerControls;
// };

export default function WavePlayerTrackControls() {
  const { state, controls } = useWavePlayerContext();

  return (
    <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4">
      {/* Progress Slider */}
      <div className="w-full space-y-2 flex flex-col items-center justify-center px-2">
        <Slider
          value={[state.currentTime]}
          max={state.duration}
          onValueChange={([value]) => controls.seek(value)}
          className="w-full"
        />
        <div className="w-full flex flex-row justify-between text-sm">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
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
          onClick={() => state.status === "playing" ? controls.pause() : controls.play()}
          className="h-10 w-10"
        >
          {state.status === "playing" ? (
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

"use client";

import { useWavePlayerContext } from "@/contexts/wave-player/context";
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

// type WavePlayerTrackControlsProps = {
//   status: WavePlayerStatus;
//   currentTime: number;
//   duration: number;
// };

export default function WavePlayerTrackControls() {
  const { state, controls } = useWavePlayerContext();

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => state.status === "playing" ? controls.pause() : controls.play()}
        >
          {state.status === "playing" ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </Button>
      </div>
      
      <div className="space-y-2">
        <Slider
          value={[state.currentTime]}
          max={state.duration}
          onValueChange={([value]) => controls.seek(value)}
        />
        <div className="flex justify-between text-sm">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Volume2 className="h-5 w-5" />
        <Slider
          value={[state.volume * 100]}
          max={100}
          onValueChange={([value]) => controls.setVolume(value / 100)}
          className="w-24"
        />
      </div>
    </div>
  );
}

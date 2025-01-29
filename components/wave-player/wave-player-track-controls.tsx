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
    <div className="w-full flex flex-col items-center justify-center gap-2">
      {/* Progress Slider */}
      <div className="w-full space-y-2">
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
      <div className="w-full flex items-center justify-between gap-4">
        {/* Control Buttons */}
        <div className="">
          <Button
            variant="outline"
            size="icon"
            onClick={() => state.status === "playing" ? controls.pause() : controls.play()}
          >
            {state.status === "playing" ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
          {/* <Volume2 className="h-5 w-5" /> */}
        </div>
        {/* Volume Slider */}
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

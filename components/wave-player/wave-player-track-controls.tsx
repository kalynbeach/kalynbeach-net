"use client";

import { formatTime } from "@/lib/utils";
import type { WavePlayerControls, WavePlayerStatus } from "@/lib/types";
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
  controls: WavePlayerControls;
  status: WavePlayerStatus;
  currentTime: number;
  duration: number;
};

export default function WavePlayerTrackControls({ controls, status, currentTime, duration }: WavePlayerTrackControlsProps) {
  return (
    <div className="wave-player-track-controls w-full flex flex-col gap-4">
      {/* Progress Bar */}
      <div className="flex flex-row items-center justify-center">
        <Slider value={[currentTime, duration]} onValueChange={(value) => controls.seek(value[0])} />
      </div>
      {/* Controls */}
      <div className="flex flex-row items-center justify-center gap-2">
        <Button variant="outline">
          <SkipBack className="size-4" />
        </Button>
        <Button variant="outline">
          <Play className="size-4" />
        </Button>
        <Button variant="outline">
          <SkipForward className="size-4" />
        </Button>
      </div>
    </div>
  );
}

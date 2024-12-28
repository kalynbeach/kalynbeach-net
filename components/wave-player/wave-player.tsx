"use client";

import { useEffect } from "react";
import { formatTime } from "@/lib/utils";
import type { WavePlayerTrack } from "@/lib/types";
import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Repeat,
  Shuffle,
} from "lucide-react";

type WavePlayerProps = {
  tracks: WavePlayerTrack[];
};

// Canvas-based frequency visualizer
function WavePlayerVisuals({ frequencyData, timeDomainData }: { 
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
}) {
  useEffect(() => {
    const canvas = document.getElementById('wave-canvas') as HTMLCanvasElement;
    if (!canvas || !frequencyData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw frequency data
    const barWidth = canvas.width / frequencyData.length;
    const heightScale = canvas.height / 256;

    ctx.fillStyle = 'hsl(var(--primary))';
    frequencyData.forEach((value, i) => {
      const height = value * heightScale;
      const x = i * barWidth;
      const y = canvas.height - height;
      ctx.fillRect(x, y, barWidth - 1, height);
    });

    // Draw waveform
    if (timeDomainData) {
      ctx.beginPath();
      ctx.strokeStyle = 'hsl(var(--secondary))';
      ctx.lineWidth = 2;
      
      const sliceWidth = canvas.width / timeDomainData.length;
      let x = 0;

      timeDomainData.forEach((value, i) => {
        const y = (value / 128.0) * (canvas.height / 2);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      });

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  }, [frequencyData, timeDomainData]);

  return (
    <canvas 
      id="wave-canvas"
      className="w-full h-full"
      width={300}
      height={150}
    />
  );
}

export default function WavePlayer({ tracks }: WavePlayerProps) {
  // if (tracks.length === 0) {
  //   return (
  //     <Card className="wave-player aspect-[5/7] w-full md:w-[320px] lg:w-[360px] flex flex-col gap-2 rounded p-2">
  //       <CardHeader className="wave-player-header font-mono h-[15%] justify-evenly space-y-0 border rounded p-2">
  //         <CardTitle className="text-lg">No tracks available</CardTitle>
  //         <CardDescription>Add some tracks to get started</CardDescription>
  //       </CardHeader>
  //       <CardContent className="wave-player-content h-[55%] flex justify-center items-center border rounded p-2">
  //         <p className="text-xs font-mono text-muted-foreground">No audio to visualize</p>
  //       </CardContent>
  //       <CardFooter className="wave-player-footer h-[30%] flex justify-center items-center border rounded p-2">
  //         <p className="text-xs font-mono text-muted-foreground">Controls disabled</p>
  //       </CardFooter>
  //     </Card>
  //   );
  // }

  const { state, controls, analyserData } = useWavePlayer(tracks);
  const { currentTrack } = state;

  return (
    <Card className="wave-player aspect-[5/7] w-full md:w-[320px] lg:w-[360px] flex flex-col gap-2 rounded p-2">
      <CardHeader className="wave-player-header font-mono h-[15%] justify-evenly space-y-0 border rounded p-2">
        <CardTitle className="text-lg">
          {currentTrack?.title || 'Loading...'}
        </CardTitle>
        <CardDescription>
          {currentTrack ? `${currentTrack.record} - ${currentTrack.artist}` : 'Loading track info...'}
        </CardDescription>
      </CardHeader>

      <CardContent className="wave-player-content h-[55%] flex flex-col justify-center items-center gap-4 border rounded p-2">
        {currentTrack?.image && (
          <div className="relative w-32 h-32 rounded overflow-hidden">
            <img
              src={currentTrack.image.src}
              alt={currentTrack.image.alt}
              className="object-cover"
            />
          </div>
        )}
        <WavePlayerVisuals
          frequencyData={analyserData.frequencyData}
          timeDomainData={analyserData.timeDomainData}
        />
      </CardContent>

      <CardFooter className="wave-player-footer h-[30%] flex flex-col justify-between items-center gap-2 border rounded p-2">
        {/* Progress bar */}
        <div className="w-full flex items-center gap-2 text-xs">
          <span>{formatTime(state.currentTime)}</span>
          <Slider
            value={[state.currentTime]}
            min={0}
            max={state.duration}
            step={0.1}
            onValueChange={([value]) => controls.seek(value)}
            className="flex-1"
          />
          <span>{formatTime(state.duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => controls.toggleShuffle()}
            className={state.isShuffle ? "text-primary" : ""}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => controls.previous()}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={() => state.status === "playing" ? controls.pause() : controls.play()}
          >
            {state.status === "playing" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => controls.next()}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => controls.toggleLoop()}
            className={state.isLoop ? "text-primary" : ""}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume control */}
        <div className="w-full flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <Slider
            value={[state.volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => controls.setVolume(value / 100)}
            className="flex-1"
          />
        </div>
      </CardFooter>
    </Card>
  );
}
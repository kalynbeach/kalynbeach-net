"use client";

import type { WavePlayerTrack } from "@/lib/types";
import { useWavePlayer } from "@/hooks/wave-player/use-wave-player";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WavePlayerProps = {
  tracks?: WavePlayerTrack[];
};

export default function WavePlayer({ tracks }: WavePlayerProps) {
  // TODO: integrate `useWavePlayer` hook

  return (
    <Card className="wave-player aspect-[5/7] w-full md:w-[320px] lg:w-[360px] flex flex-col gap-2 rounded p-2">
      <CardHeader className="wave-player-header font-mono h-[15%] justify-evenly space-y-0 border rounded p-2">
        <CardTitle className="text-lg">title</CardTitle>
        <CardDescription>record - artist</CardDescription>
      </CardHeader>
      <CardContent className="wave-player-content h-[55%] flex justify-center items-center border rounded p-2">
        <p className="text-xs font-mono text-muted-foreground">visuals</p>
      </CardContent>
      <CardFooter className="wave-player-footer h-[30%] flex justify-center items-center border rounded p-2">
        <p className="text-xs font-mono text-muted-foreground">controls</p>
      </CardFooter>
    </Card>
  );
}
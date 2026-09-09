import type { WavePlayerTrack } from "@/lib/types/wave-player";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WavePlayerTrackInfoProps = {
  track: WavePlayerTrack;
};

export default function WavePlayerTrackInfo({
  track,
}: WavePlayerTrackInfoProps) {
  return (
    <div className="wave-player-track-info border-muted/50 flex h-full w-full flex-col gap-1 border p-2">
      <CardTitle>
        <p className="font-mono text-lg">{track.title}</p>
      </CardTitle>
      <CardDescription>
        <div className="flex flex-col gap-1">
          <p className="text-secondary-foreground/90 font-mono text-sm">
            {track.record}
          </p>
          <p className="text-secondary-foreground/80 font-mono text-xs">
            {track.artist}
          </p>
        </div>
      </CardDescription>
    </div>
  );
}

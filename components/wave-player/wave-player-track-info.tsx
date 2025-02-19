import type { WavePlayerTrack } from "@/lib/types";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WavePlayerTrackInfoProps = {
  track: WavePlayerTrack;
};

export default function WavePlayerTrackInfo({ track }: WavePlayerTrackInfoProps) {
  return (
    <div className="wave-player-track-info w-full h-full flex flex-col gap-1 border border-muted/50 p-2">
      <CardTitle>
        <p className="font-mono text-lg">{track.title}</p>
      </CardTitle>
      <CardDescription>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm text-secondary-foreground/90">{track.record}</p>
          <p className="font-mono text-xs text-secondary-foreground/80">{track.artist}</p>
        </div>
      </CardDescription>
    </div>
  );
}

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
    <div className="wave-player-track-info w-full h-full flex flex-col gap-1">
      <CardTitle>
        <p className="font-mono text-lg">{track.title}</p>
      </CardTitle>
      <CardDescription>
        <p className="font-mono">{track.artist}</p>
        <p className="font-mono text-sm">{track.record}</p>
      </CardDescription>
    </div>
  );
}

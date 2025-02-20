"use client";

import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import WavePlayer from "./wave-player";

type WavePlayerBlockProps = {
  playlist: WavePlayerPlaylist;
};

export default function WavePlayerBlock({ playlist }: WavePlayerBlockProps) {
  return (
    <div className="wave-player-block">
      <WavePlayer playlist={playlist} />
    </div>
  );
}
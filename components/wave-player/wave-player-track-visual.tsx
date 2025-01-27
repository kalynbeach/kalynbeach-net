import type { WavePlayerTrack } from "@/lib/types";
import Image from "next/image";

// TODO: implement waveform and R3F scene visual options
type WavePlayerTrackVisualOption = "image" | "waveform" | "scene";

type WavePlayerTrackVisualProps = {
  image: WavePlayerTrack["image"];
};

export default function WavePlayerTrackVisual({ image }: WavePlayerTrackVisualProps) {
  return (
    <div className="wave-player-track-visual w-full h-full border">
      <Image
        className="wave-player-track-visual-image size-full object-cover"
        src={image.src}
        alt={image.alt}
        width={600}
        height={600}
        quality={100}
        priority
      />
    </div>
  );
}

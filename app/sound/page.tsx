import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
// import { SoundContextProvider } from "@/contexts/sound-context";
// import SoundBlock from "@/components/sound/sound-block";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
import WavePlayer from "@/components/wave-player/wave-player";
import type { WavePlayerTrack, WavePlayerPlaylist } from "@/lib/types/wave-player";

// TESTING
const TEST_TRACKS: WavePlayerTrack[] = [
  {
    id: 1,
    title: "0_initializer",
    artist: "Kalyn Beach",
    record: "loops",
    src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
    image: {
      src: "/icon.svg",
      alt: "0_initializer",
    },
    isLoop: true,
  },
];

// TESTING
const TEST_PLAYLIST: WavePlayerPlaylist = {
  id: 1,
  title: "playlist_0",
  tracks: TEST_TRACKS,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="sound" />
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        {/* <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SoundContextProvider>
            <SoundBlock />
          </SoundContextProvider>
        </Suspense> */}
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <WavePlayerProvider>
            <WavePlayer playlist={TEST_PLAYLIST} />
          </WavePlayerProvider>
        </Suspense>
      </div>
    </div>
  );
}

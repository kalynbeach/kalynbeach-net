import { Suspense } from "react";
import { SoundContextProvider } from "@/contexts/sound-context";
import { WavePlayerContextProvider, TEST_PLAYLIST, TEST_TRACKS } from "@/contexts/wave-player-context";
import SitePageHeader from "@/components/site/site-page-header";
import SoundBlock from "@/components/sound/sound-block";
import WavePlayer from "@/components/wave-player/wave-player";

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
          <WavePlayerContextProvider>
            <WavePlayer playlist={TEST_PLAYLIST} />
          </WavePlayerContextProvider>
        </Suspense>
      </div>
    </div>
  );
}

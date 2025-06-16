import type { Metadata } from "next";
import { Suspense } from "react";
import SitePage from "@/components/site/site-page";
import { SoundContextProvider } from "@/contexts/sound-context";
import SoundBlock from "@/components/wave-lab/sound-block";

export const metadata: Metadata = {
  title: "wave-lab",
};

// TODO: rename SoundBlock to WaveLab
// TODO: refactor and optimize WaveLab audio code
// TODO: add and optimally render WaveLab in WaveLabPage
export default function WaveLabPage() {
  return (
    <SitePage>
      <main className="size-full flex flex-col items-center justify-center gap-4">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SoundContextProvider>
            <SoundBlock />
          </SoundContextProvider>
        </Suspense>
      </main>
    </SitePage>
  );
}

import SitePageHeader from "@/components/site/site-page-header";
// import { Suspense } from "react";
// import { SoundContextProvider } from "@/contexts/sound-context";
// import SoundBlock from "@/components/sound/sound-block";

// TODO: rename SoundBlock to WaveLab
// TODO: refactor and optimize WaveLab audio code
// TODO: add and optimally render WaveLab in WaveLabPage
export default function WaveLabPage() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="Sound" />
      <h2 className="text-xl font-mono font-medium">WaveLab</h2>
      <p className="text-lg">🚧 🚧 🚧</p>
      <div className="w-full h-full flex flex-col items-center justify-start gap-4">
        {/* <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SoundContextProvider>
            <SoundBlock />
          </SoundContextProvider>
        </Suspense> */}
      </div>
    </div>
  );
}

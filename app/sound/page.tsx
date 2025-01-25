import { Suspense } from "react";
import { SoundContextProvider } from "@/contexts/sound-context";
import SitePageHeader from "@/components/site/site-page-header";
import SoundBlock from "@/components/sound/sound-block";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="sound" />
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SoundContextProvider>
            <SoundBlock />
          </SoundContextProvider>
        </Suspense>
      </div>
    </div>
  );
}

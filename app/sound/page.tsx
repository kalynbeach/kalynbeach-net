import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import { SoundContextProvider } from "@/contexts/sound-context";
import SoundBlock from "@/components/sound/sound-block";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="sound" />
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SoundContextProvider>
            <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
              <SoundBlock />
            </Suspense>
          </SoundContextProvider>
        </Suspense>
      </div>
    </div>
  );
}

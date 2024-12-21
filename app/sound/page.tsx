import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import { SoundContextProvider } from "@/contexts/sound-context";
import SoundBlock from "@/components/sound-block";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="sound" />
      <SoundContextProvider>
        <Suspense fallback={<div>loading...</div>}>
          <SoundBlock />
        </Suspense>  
      </SoundContextProvider>
    </div>
  );
}

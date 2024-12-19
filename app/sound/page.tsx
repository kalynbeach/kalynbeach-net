import SitePageHeader from "@/components/site/site-page-header";
import AudioBlock from "@/components/audio-block";
import { SoundContextProvider } from "@/contexts/sound-context";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="sound" />
      <AudioBlock />
      {/* <SoundContextProvider>
        <AudioBlock />
      </SoundContextProvider> */}
    </div>
  );
}

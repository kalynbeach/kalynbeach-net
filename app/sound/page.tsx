import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import AudioBlock from "@/components/audio-block";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <SitePageHeader title="sound" />
      <AudioBlock />
    </div>
  );
}

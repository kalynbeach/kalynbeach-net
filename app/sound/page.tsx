import SitePageHeader from "@/components/site/site-page-header";
import WaveFrame from "@/components/wave-frame";

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <SitePageHeader title="sound" />
      <WaveFrame />
    </div>
  );
}

import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import ThreeCanvas from "@/components/rtf/canvas";

export default function Lab() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="lab" />
      <div className="size-full flex flex-col items-center justify-center">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <ThreeCanvas />
        </Suspense>
      </div>
    </div>
  );
}

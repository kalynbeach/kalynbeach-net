import { Suspense } from "react";
// import SitePageHeader from "@/components/site/site-page-header";
import { ThreeSceneBlock, ThreeSceneBlockSkeleton } from "@/components/three/scene-block";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      {/* <SitePageHeader title="" /> */}
      <div className="w-full h-full flex items-center justify-center">
        <Suspense fallback={<ThreeSceneBlockSkeleton />}>
          <ThreeSceneBlock />
        </Suspense>
      </div>
    </div>
  );
}

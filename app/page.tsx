import { Suspense } from "react";
// import SitePageHeader from "@/components/site/site-page-header";
import { ThreeSceneSkeleton } from "@/components/three/scene";
import { ThreeSceneBlock } from "@/components/three/scene-block";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      {/* <SitePageHeader title="" /> */}
      <div className="w-full h-full flex items-center justify-center">
        <Suspense fallback={<ThreeSceneSkeleton />}>
          <ThreeSceneBlock />
        </Suspense>
      </div>
    </div>
  );
}

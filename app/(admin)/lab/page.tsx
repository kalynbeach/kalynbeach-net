import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import MeshSVGExporter from "@/components/r3f/mesh-svg-exporter";
// import ThreeCanvas from "@/components/r3f/canvas";

function SkeletonLoader() {
  return (
    <div className="w-full max-w-4xl mx-auto animate-pulse">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Canvas skeleton */}
        <div className="w-full md:w-2/3 bg-muted rounded-lg" style={{ aspectRatio: "1/1" }} />
        {/* Controls skeleton */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Lab() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="lab" />
      <h2 className="font-mono text-lg font-medium">MeshSVGExporter</h2>
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Suspense fallback={<SkeletonLoader />}>
          <MeshSVGExporter />
        </Suspense>
        {/* <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <ThreeCanvas />
        </Suspense> */}
      </div>
    </div>
  );
}

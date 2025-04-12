import type { Metadata } from "next";
import { Suspense } from "react";
import SitePage from "@/components/site/site-page";
import MeshSVGExporter from "@/components/r3f/mesh-svg-exporter";

export const metadata: Metadata = {
  title: "lab",
};

function MeshSVGExporterSkeleton() {
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
    <SitePage>
      <main className="w-full h-full flex flex-col items-center justify-center">
        <Suspense fallback={<MeshSVGExporterSkeleton />}>
          <MeshSVGExporter />
        </Suspense>
      </main>
    </SitePage>
  );
}

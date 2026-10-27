import { Suspense } from "react";
import { pageMetadata } from "@/lib/site";
import MeshSVGExporter from "@/components/r3f/mesh-svg-exporter";

export const metadata = pageMetadata("/lab");

function MeshSVGExporterSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Canvas skeleton */}
        <div
          className="bg-muted w-full rounded-lg md:w-2/3"
          style={{ aspectRatio: "1/1" }}
        />
        {/* Controls skeleton */}
        <div className="w-full space-y-4 md:w-1/3">
          <div className="bg-muted h-64 rounded-lg" />
          <div className="bg-muted h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Lab() {
  return (
    <Suspense fallback={<MeshSVGExporterSkeleton />}>
      <MeshSVGExporter />
    </Suspense>
  );
}

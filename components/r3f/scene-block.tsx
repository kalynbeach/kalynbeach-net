"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ThreeSceneSkeleton } from "@/components/r3f/scene";

const ThreeSceneClient = dynamic(
  () => import("./scene").then((mod) => mod.ThreeScene),
  {
    ssr: false,
    loading: () => <ThreeSceneSkeleton />,
  }
);

const DefaultScene = dynamic(() => import("./scene").then((mod) => mod.Scene), {
  ssr: false,
});

export function ThreeSceneBlock({ className }: { className?: string }) {
  return (
    <div className={className || "bg-background relative size-96"}>
      <ThreeSceneClient
        className={className}
        fallback={<ThreeSceneSkeleton />}
        showPerformanceMonitor={false && process.env.NODE_ENV === "development"}
      >
        <Suspense fallback={null}>
          <DefaultScene />
        </Suspense>
      </ThreeSceneClient>
    </div>
  );
}

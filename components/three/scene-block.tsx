"use client";

import dynamic from "next/dynamic";
import { ThreeSceneSkeleton } from "@/components/three/scene";
// import type { ComponentProps } from "react";

// type ThreeSceneProps = ComponentProps<typeof import("./scene").ThreeScene>;

const ThreeSceneClient = dynamic(
  () => import("./scene").then((mod) => mod.ThreeScene),
  {
    ssr: false,
    loading: () => <ThreeSceneSkeleton />
  }
);

export function ThreeSceneBlock({ className }: { className?: string }) {
  return (
    <div className={className || "relative size-96 bg-background"}>
      <ThreeSceneClient
        className={className}
        fallback={<ThreeSceneSkeleton />}
        showPerformanceMonitor={process.env.NODE_ENV === "development"}
      />
    </div>
  );
}

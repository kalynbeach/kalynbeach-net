"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { ThreeSceneSkeleton } from "@/components/three/scene";

type ThreeSceneProps = ComponentProps<typeof import("./scene").ThreeScene>;

const ThreeSceneClient = dynamic(
  () => import("./scene").then((mod) => ({ default: mod.ThreeScene })),
  {
    ssr: false,
    loading: () => (<ThreeSceneSkeleton />),
  }
);

export function ThreeSceneBlock({ className }: { className?: string }) {
  const clientProps: Partial<ThreeSceneProps> = {
    className: className,
    fallback: <ThreeSceneSkeleton />,
  };

  return (
    <div className={className || "relative size-96 bg-background"}>
      <ThreeSceneClient {...clientProps} />
    </div>
  );
}

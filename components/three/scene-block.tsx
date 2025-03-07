"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

type ThreeSceneProps = ComponentProps<typeof import("./scene").ThreeScene>;

const ThreeSceneClient = dynamic(
  () => import("./scene").then((mod) => ({ default: mod.ThreeScene })),
  {
    ssr: false,
    loading: () => (<ThreeSceneBlockSkeleton />),
  }
);

export function ThreeSceneBlockSkeleton() {
  return (
    <div className="h-[400px] w-full flex items-center justify-center bg-background">
      <div className="font-mono text-sm">loading...</div>
    </div>
  );
}

export function ThreeSceneBlock({
  className,
  fallbackText = "loading...",
}: {
  className?: string;
  fallbackText?: string;
}) {
  const clientProps: Partial<ThreeSceneProps> = {
    className: "w-full h-full",
    fallback: (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <p className="font-mono text-lg">{fallbackText}</p>
      </div>
    ),
  };

  return (
    <div className={className || "relative h-[400px] w-full"}>
      <ThreeSceneClient {...clientProps} />
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { GLProps } from "@react-three/fiber";
import { SpinnerIcon } from "@phosphor-icons/react";
import { checkWebGLAvailability } from "@/lib/webgl";

const subscribeToBrowserEnvironment = () => () => {};
const getServerWebGLAvailability = () => null;
let cachedWebGLAvailability: boolean | null | undefined;

function getWebGLAvailabilitySnapshot() {
  if (cachedWebGLAvailability === undefined) {
    cachedWebGLAvailability = checkWebGLAvailability();
  }

  return cachedWebGLAvailability;
}

export function ThreeScene({
  children,
  className = "three-scene relative size-96",
  glProps = {},
  fallback = <WebGLFallback />,
}: {
  children: ReactNode;
  className?: string;
  glProps?: GLProps;
  fallback?: ReactNode;
}) {
  const isWebGLAvailable = useSyncExternalStore(
    subscribeToBrowserEnvironment,
    getWebGLAvailabilitySnapshot,
    getServerWebGLAvailability
  );

  if (isWebGLAvailable === null) return <ThreeSceneSkeleton />;
  if (!isWebGLAvailable) return <div className={className}>{fallback}</div>;

  const defaultGlProps = {
    powerPreference: "high-performance" as const,
    antialias: true,
    stencil: false,
    depth: true,
    ...glProps,
  };

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
        gl={defaultGlProps}
        performance={{ min: 0.5 }}
        shadows
      >
        {children}
      </Canvas>
    </div>
  );
}

export function ThreeSceneSkeleton() {
  return (
    <div className="bg-background flex size-96 items-center justify-center">
      <SpinnerIcon className="size-5 animate-spin" />
    </div>
  );
}

function WebGLFallback() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center p-4">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          WebGL Not Available
        </h3>
        <p className="text-gray-600">
          Your browser or device doesn&apos;t support WebGL, which is required
          for 3D rendering.
        </p>
      </div>
    </div>
  );
}

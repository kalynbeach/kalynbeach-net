"use client";

import { Suspense, memo, useDeferredValue, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { GLProps } from "@react-three/fiber";
import { Html, Preload } from "@react-three/drei";
import { Loader } from "lucide-react";
import { useTheme } from "next-themes";
import { checkWebGLAvailability } from "@/lib/webgl";
import TorusMesh from "@/components/r3f/meshes/torus-mesh";

const subscribeToBrowserEnvironment = () => () => {};
const getServerWebGLAvailability = () => null;
let cachedWebGLAvailability: boolean | null | undefined;

function getWebGLAvailabilitySnapshot() {
  if (cachedWebGLAvailability === undefined) {
    cachedWebGLAvailability = checkWebGLAvailability();
  }

  return cachedWebGLAvailability;
}

/**
 * Home page scene
 */
export const Scene = memo(function Scene() {
  const { resolvedTheme } = useTheme();

  const deferredTheme = useDeferredValue(resolvedTheme);
  const isDarkTheme = deferredTheme === "dark";

  const backgroundColor = isDarkTheme ? "#030303" : "#FFFFFF";

  return (
    <Suspense
      fallback={
        <Html center>
          <ThreeSceneSkeleton />
        </Html>
      }
    >
      <color attach="background" args={[backgroundColor]} />
      <ambientLight intensity={2.4} />
      <TorusMesh
        color={isDarkTheme ? "#FFFFFF" : "#030303"}
        radius={1.14}
        tube={1.14}
        segments={32}
      />
      {/* <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        enableRotate={true}
      /> */}
      <Preload all />
    </Suspense>
  );
});

export function ThreeScene({
  children,
  className = "three-scene relative size-96",
  glProps = {},
  fallback = <WebGLFallback />,
}: {
  children?: ReactNode;
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
        {children || <Scene />}
      </Canvas>
    </div>
  );
}

export function ThreeSceneSkeleton() {
  return (
    <div className="bg-background flex size-96 items-center justify-center">
      <Loader className="size-5 animate-spin" />
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

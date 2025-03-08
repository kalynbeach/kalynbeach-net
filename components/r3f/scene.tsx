"use client";

import * as THREE from "three";
import React, {
  Suspense,
  memo,
  useDeferredValue,
  useState,
  useEffect,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { GLProps } from "@react-three/fiber";
import { Html, Preload } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Loader } from "lucide-react";
import { useTheme } from "next-themes";
import { useThreeSetup } from "@/hooks/three/use-three-setup";
import { checkWebGLAvailability } from "@/lib/webgl";
import TorusMesh from "@/components/r3f/meshes/torus-mesh";

/**
 * Home page scene
 */
export const Scene = memo(function Scene() {
  const { resolvedTheme } = useTheme();

  const deferredTheme = useDeferredValue(resolvedTheme);
  const isDarkTheme = deferredTheme === "dark";

  useThreeSetup({
    backgroundColor: isDarkTheme ? "#000000" : "#FFFFFF",
    enableShadows: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
  });

  return (
    <Suspense
      fallback={
        <Html center>
          <ThreeSceneSkeleton />
        </Html>
      }
    >
      <ambientLight intensity={2.4} />
      <TorusMesh
        color={isDarkTheme ? "#FFFFFF" : "#000000"}
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
  className = "relative size-96 bg-background",
  glProps = {},
  captureProps,
  showPerformanceMonitor = false,
  fallback = <WebGLFallback />,
}: {
  children?: React.ReactNode;
  className?: string;
  glProps?: GLProps;
  captureProps?: {
    onCapture?: (svg: string) => void;
    registerCapture?: (captureMethod: () => void) => void;
  };
  showPerformanceMonitor?: boolean;
  fallback?: React.ReactNode;
}) {
  const [isWebGLAvailable, setIsWebGLAvailable] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    setIsWebGLAvailable(checkWebGLAvailability());
  }, []);

  if (isWebGLAvailable === null) return <ThreeSceneSkeleton />;
  if (!isWebGLAvailable) return <div className={className}>{fallback}</div>;

  const defaultGlProps = {
    powerPreference: "high-performance" as const,
    antialias: true,
    stencil: false,
    depth: true,
    ...glProps,
  };

  const childrenWithProps = captureProps
    ? React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          console.log("Passing capture props to child component");
          return React.cloneElement(child, {
            ...(captureProps as any),
          });
        }
        return child;
      })
    : children;

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
        gl={defaultGlProps}
        performance={{ min: 0.5 }}
      >
        {childrenWithProps || <Scene />}
        {showPerformanceMonitor && <Perf position="top-right" />}
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
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
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

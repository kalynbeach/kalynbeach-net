"use client";

import * as THREE from "three";
import type React from "react";
import {
  Suspense,
  useState,
  useEffect,
  memo,
  cache,
  useDeferredValue,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Preload } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Loader } from "lucide-react";
import { useTheme } from "next-themes";
import { useThreeSetup } from "@/hooks/three/use-three-setup";
import TorusMesh from "@/components/r3f/meshes/torus-mesh";

const Scene = memo(function Scene() {
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
      {/* <pointLight position={[10, 10, 10]} intensity={1} castShadow /> */}
      <TorusMesh
        color={isDarkTheme ? "#FFFFFF" : "#000000"}
        radius={1.14}
        tube={1.14}
        segments={32}
      />
      {/* <Environment preset="city" /> */}
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

const checkWebGLAvailability = cache(() => {
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch (e) {
    return false;
  }
});

export function ThreeScene({
  className = "relative size-96 bg-background",
  fallback = <WebGLFallback />,
  showPerformanceMonitor = false,
}: {
  className?: string;
  fallback?: React.ReactNode;
  showPerformanceMonitor?: boolean;
}) {
  const [isWebGLAvailable, setIsWebGLAvailable] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    setIsWebGLAvailable(checkWebGLAvailability());
  }, []);

  if (isWebGLAvailable === null) return <ThreeSceneSkeleton />;
  if (!isWebGLAvailable) return <div className={className}>{fallback}</div>;

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio} // Cap DPR for performance
        gl={{
          powerPreference: "high-performance",
          antialias: true,
          stencil: false,
          depth: true,
        }}
        performance={{ min: 0.5 }} // Adaptive performance scaling
      >
        <Scene />
        {showPerformanceMonitor && <Perf position="top-left" />}
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
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 p-8">
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

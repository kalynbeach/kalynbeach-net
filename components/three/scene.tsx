"use client";

import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import React, { Suspense, memo, useDeferredValue, useState, useEffect } from "react";
import { Html, Preload } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Loader } from "lucide-react";
import { useTheme } from "next-themes";
import { useThreeSetup } from "@/hooks/three/use-three-setup";
import { checkWebGLAvailability } from "@/lib/webgl";
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

// Export the Scene component
export { Scene };

/**
 * Custom hook to access the Three.js renderer and scene
 * Useful for SVG capture or other operations that need direct access to renderer
 */
export function useThreeInstance() {
  const { gl, scene } = useThree();
  
  return {
    renderer: gl,
    scene
  };
}

export function ThreeScene({
  className = "relative size-96 bg-background",
  fallback = <WebGLFallback />,
  showPerformanceMonitor = false,
  children,
  glProps = {},
  captureProps,
}: {
  className?: string;
  fallback?: React.ReactNode;
  showPerformanceMonitor?: boolean;
  children?: React.ReactNode;
  glProps?: {
    preserveDrawingBuffer?: boolean;
    antialias?: boolean;
    alpha?: boolean;
    stencil?: boolean;
    depth?: boolean;
    powerPreference?: "high-performance" | "low-power" | "default";
    [key: string]: any;
  };
  captureProps?: {
    onCapture?: (svg: string) => void;
    registerCapture?: (captureMethod: () => void) => void;
  };
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
    ...glProps
  };

  const childrenWithProps = captureProps 
    ? React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          console.log("Passing capture props to child component");
          return React.cloneElement(child, {
            ...(captureProps as any)
          });
        }
        return child;
      })
    : children;

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio} // Cap DPR for performance
        gl={defaultGlProps}
        performance={{ min: 0.5 }} // Adaptive performance scaling
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

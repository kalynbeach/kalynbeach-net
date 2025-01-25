"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SceneProvider } from "@/contexts/scene-context";
import SceneControls from "@/components/r3f/scene-controls";

const Scene = dynamic(() => import("@/components/r3f/scene"), { ssr: false });

export default function ThreeCanvas() {
  return (
    <>
      <Suspense fallback={null}>
        <div className="border-primary relative h-full w-full border-2">
          <SceneProvider>
            <SceneControls />
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
              <Scene />
              <OrbitControls />
            </Canvas>
          </SceneProvider>
        </div>
      </Suspense>
    </>
  );
}

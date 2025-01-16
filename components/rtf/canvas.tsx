'use client'

import dynamic from "next/dynamic";
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { SceneProvider } from "@/contexts/scene-context";
import SceneControls from '@/components/rtf/scene-controls';

const Scene = dynamic(() => import('@/components/rtf/scene'), { ssr: false });

export default function ThreeCanvas() {
  return (
    <SceneProvider>
      <div className="relative w-full h-full border border-primary">
        <SceneControls />
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <Scene />
          <OrbitControls />
        </Canvas>
      </div>
    </SceneProvider>
  )
}
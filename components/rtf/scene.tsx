'use client'

import { useSceneContext } from '@/contexts/scene-context'
import SphereMesh from '@/components/rtf/meshes/sphere-mesh'
import TorusMesh from '@/components/rtf/meshes/torus-mesh'

export default function Scene() {
  const { currentScene } = useSceneContext()

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      {currentScene === 'sphere' ? <SphereMesh /> : <TorusMesh />}
    </>
  )
}
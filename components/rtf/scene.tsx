'use client'

import { useTheme } from 'next-themes'
import { useSceneContext } from '@/contexts/scene-context'
import SphereMesh from '@/components/rtf/meshes/sphere-mesh'
import TorusMesh from '@/components/rtf/meshes/torus-mesh'

export default function Scene() {
  const { currentScene } = useSceneContext()
  const { resolvedTheme } = useTheme()

  return (
    <>
      <ambientLight intensity={1.4} />
      {/* <pointLight position={[10, 10, 10]} intensity={0.5} /> */}
      {currentScene === 'sphere' && <SphereMesh color={resolvedTheme === 'dark' ? '#FFFFFF' : '#000000'} />}
      {currentScene === 'torus' && <TorusMesh color={resolvedTheme === 'dark' ? '#FFFFFF' : '#000000'} />}
    </>
  )
}
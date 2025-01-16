'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'

export default function TorusMesh() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      // meshRef.current.rotation.x += delta * 0.9
      meshRef.current.rotation.y += delta * 0.03
      meshRef.current.rotation.z += delta * 0.3
    }
  })

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1, 1, 32, 32]} />
      <meshStandardMaterial color="#FFFFFF" wireframe />
    </mesh>
  )
}


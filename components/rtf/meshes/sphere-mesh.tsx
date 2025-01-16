"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Mesh } from "three"

export default function SphereMesh() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5
      meshRef.current.rotation.y += delta * 0.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#FFFFFF" wireframe />
    </mesh>
  )
}
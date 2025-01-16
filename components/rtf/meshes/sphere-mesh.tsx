"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Mesh } from "three"

export default function SphereMesh() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y -= 0.000114;
      // meshRef.current.rotation.x += delta * 0.5
      // meshRef.current.rotation.y += delta * 0.2
    }
  })

  return (
    <mesh ref={meshRef} rotation={[1.5708, 1.5708, 0]}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshStandardMaterial color="#FFFFFF" wireframe />
    </mesh>
  )
}
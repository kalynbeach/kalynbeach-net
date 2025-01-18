"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

type TorusMeshProps = {
  color: string;
};

export default function TorusMesh({ color }: TorusMeshProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y -= delta * 0.0114;
      meshRef.current.rotation.z += delta * 0.0114;
    }
  });

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1, 1, 32, 32]} />
      <meshStandardMaterial color={color} wireframe />
    </mesh>
  );
}

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

type TorusMeshProps = {
  color: string;
  radius: number;
  tube: number;
  segments: number;
};

export default function TorusMesh({ color, radius, tube, segments }: TorusMeshProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.014;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[1.5708, 0, 0]}>
      <torusGeometry args={[radius, tube, segments, segments]} />
      <meshStandardMaterial color={color} wireframe />
    </mesh>
  );
}

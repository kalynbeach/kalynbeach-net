"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

type SphereMeshProps = {
  color: string;
  radius: number;
  segments: number;
};

export default function SphereMesh({ color, radius, segments }: SphereMeshProps) {
  const meshRef = useRef<Mesh>(null);

  // useFrame((_, delta) => {
  //   if (meshRef.current) {
  //     meshRef.current.rotation.y += delta * 1.0114;
  //     // meshRef.current.rotation.y -= delta * 0.0114;
  //   }
  // });

  return (
    <mesh ref={meshRef} rotation={[0, 1.5708, 0]}>
      <sphereGeometry args={[radius, segments, segments]} />
      <meshStandardMaterial color={color} wireframe />
    </mesh>
  );
}

"use client";

import TorusMesh from "@/components/r3f/meshes/torus-mesh";
import SphereMesh from "@/components/r3f/meshes/sphere-mesh";

type KBSceneProps = {
  primaryColor: string;
};

export default function KBScene({ primaryColor }: KBSceneProps) {
  return (
    <>
      <TorusMesh
        radius={1}
        tube={1}
        segments={32}
        color={primaryColor}
      />
      <SphereMesh
        radius={0.5}
        segments={16}
        color={primaryColor}
      />
    </>
  );
}
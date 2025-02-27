"use client";

import SphereMesh from "@/components/r3f/meshes/sphere-mesh";

type SphereSceneProps = {
  primaryColor: string;
};

export default function SphereScene({ primaryColor }: SphereSceneProps) {
  return (
    <>
      <SphereMesh
        radius={1}
        segments={32}
        color={primaryColor}
      />
    </>
  );
}
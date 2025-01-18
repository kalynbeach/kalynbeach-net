"use client";

import SphereMesh from "@/components/r3f/meshes/sphere-mesh";

type SphereSceneProps = {
  primaryColor: string;
};

export default function SphereScene({ primaryColor }: SphereSceneProps) {
  return (
    <>
      <SphereMesh color={primaryColor} />
    </>
  );
}
"use client";

import TorusMesh from "@/components/r3f/meshes/torus-mesh";

type TorusSceneProps = {
  primaryColor: string;
};

export default function TorusScene({ primaryColor }: TorusSceneProps) {
  return (
    <>
      <TorusMesh color={primaryColor} />
    </>
  );
}
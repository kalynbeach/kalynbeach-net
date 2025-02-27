"use client";

import { useTheme } from "next-themes";
import { useSceneContext } from "@/contexts/scene-context";
import SphereScene from "@/components/r3f/scenes/sphere-scene";
import TorusScene from "@/components/r3f/scenes/torus-scene";
import KBScene from "@/components/r3f/scenes/kb-scene";

export default function Scene() {
  const { currentScene } = useSceneContext();
  const { resolvedTheme } = useTheme();

  return (
    <>
      <ambientLight intensity={1.4} />
      {currentScene === "kb" && (
        <KBScene primaryColor={resolvedTheme === "dark" ? "#FFFFFF" : "#000000"} />
      )}
      {currentScene === "sphere" && (
        <SphereScene primaryColor={resolvedTheme === "dark" ? "#FFFFFF" : "#000000"} />
      )}
      {currentScene === "torus" && (
        <TorusScene primaryColor={resolvedTheme === "dark" ? "#FFFFFF" : "#000000"} />
      )}
    </>
  );
}

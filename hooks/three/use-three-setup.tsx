"use client";

import * as THREE from "three";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

type ThreeSetupOptions = {
  enableShadows?: boolean;
  toneMapping?: THREE.ToneMapping;
  outputColorSpace?: THREE.ColorSpace;
};

export function useThreeSetup({
  enableShadows = true,
  toneMapping = THREE.ACESFilmicToneMapping,
  outputColorSpace = THREE.SRGBColorSpace,
}: ThreeSetupOptions = {}) {
  // const { resolvedTheme } = useTheme();
  const { gl, scene } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    gl.shadowMap.enabled = enableShadows;
    gl.toneMapping = toneMapping;
    gl.outputColorSpace = outputColorSpace;

    // scene.background = new THREE.Color(
    //   resolvedTheme === "dark" ? "#000000" : "#FFFFFF"
    // );

    initialized.current = true;

    return () => {
      // Cleanup function (empty for now)
    };
  }, [gl, scene, enableShadows, toneMapping, outputColorSpace]);
}

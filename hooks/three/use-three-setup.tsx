"use client";

import * as THREE from "three";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Configuration options for Three.js renderer setup
 */
type ThreeSetupOptions = {
  backgroundColor?: string;
  enableShadows?: boolean;
  toneMapping?: THREE.ToneMapping;
  outputColorSpace?: THREE.ColorSpace;
};

/**
 * Custom hook to configure Three.js renderer and scene.
 * Optimized for React 19 with proper dependency tracking and memoization.
 */
export function useThreeSetup({
  backgroundColor = "#030303",
  enableShadows = true,
  toneMapping = THREE.ACESFilmicToneMapping,
  outputColorSpace = THREE.SRGBColorSpace,
}: ThreeSetupOptions = {}) {
  const { gl, scene } = useThree();
  const initialized = useRef(false);

  const backgroundColorObj = useMemo(
    () => new THREE.Color(backgroundColor),
    [backgroundColor]
  );

  const setupRenderer = useCallback(() => {
    gl.shadowMap.enabled = enableShadows;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = toneMapping;
    gl.outputColorSpace = outputColorSpace;
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.info.autoReset = false;
    scene.background = backgroundColorObj;

    return true;
  }, [
    gl,
    scene,
    enableShadows,
    toneMapping,
    outputColorSpace,
    backgroundColorObj,
  ]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = setupRenderer();

    return () => {
      gl.renderLists.dispose();
      initialized.current = false;
    };
  }, [setupRenderer, gl]);
}

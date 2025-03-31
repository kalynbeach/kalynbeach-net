"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFrequencyData } from "@/hooks/sound/use-frequency-data";
import type { VisualizerProps } from "@/lib/types/sound";

function FrequencyBars({ analyser, isInitialized }: VisualizerProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const getFrequencyData = useFrequencyData(analyser, isInitialized);
  const instances = useMemo(
    () => Math.min(analyser?.frequencyBinCount || 0, 128),
    [analyser]
  );

  const colors = useMemo(() => {
    const colorArray = new Float32Array(instances * 3);
    for (let i = 0; i < instances; i++) {
      const hue = i / instances;
      const color = new THREE.Color().setHSL(hue, 1, 0.5);
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }
    return colorArray;
  }, [instances]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scales = useRef<Float32Array>(new Float32Array(instances));

  useFrame(() => {
    if (!isInitialized || !analyser || !mesh.current) return;

    const frequencyData = getFrequencyData();

    for (let i = 0; i < instances; i++) {
      const value = frequencyData[i] / 255;
      scales.current[i] = value;

      dummy.position.set((i - instances / 2) * 0.1, value * 2 - 1, 0);
      dummy.scale.set(0.05, Math.max(value * 4, 0.1), 0.05);
      dummy.updateMatrix();

      mesh.current.setMatrixAt(i, dummy.matrix);
    }

    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, instances]}>
        <boxGeometry />
        <meshPhongMaterial vertexColors={true} />
      </instancedMesh>
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <ambientLight intensity={0.5} />
    </>
  );
}

export default FrequencyBars;

"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useWaveformData } from "@/hooks/sound/use-waveform-data";
import type { VisualizerProps } from "@/lib/types";

export default function Waveform({ analyser, isInitialized }: VisualizerProps) {
  const lineRef = useRef<any>(null);
  const getWaveformData = useWaveformData(analyser, isInitialized);
  
  const points = useMemo(() => {
    console.log("[Waveform] analyser:", analyser);
    if (!analyser?.frequencyBinCount) return [];
    return Array.from({ length: analyser.frequencyBinCount }, (_, i) => 
      new THREE.Vector3(
        (i / analyser.frequencyBinCount) * 4 - 2,
        0,
        0
      )
    );
  }, [analyser]);

  useFrame(() => {
    if (!isInitialized || !analyser || !lineRef.current || points.length === 0) return;

    try {
      const waveformData = getWaveformData();
      if (!waveformData?.length) return;

      // Update existing points instead of creating new ones
      points.forEach((point, i) => {
        if (i < waveformData.length) {
          point.y = ((waveformData[i] / 128.0) - 1) * 2;
        }
      });

      // Update the line's points directly
      lineRef.current.geometry.setFromPoints(points);
    } catch (error) {
      console.error('Error updating waveform:', error);
    }
  });

  if (!analyser || !isInitialized || points.length === 0) return null;

  return (
    <>
      <Line
        ref={lineRef}
        points={points}
        color="#00ff00"
        lineWidth={1}
      />
      <ambientLight intensity={0.5} />
    </>
  );
}
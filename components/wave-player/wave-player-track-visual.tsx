"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WavePlayerTrack, WavePlayerVisualization } from "@/lib/types/wave-player";

// TODO: implement image and R3F scene visual options
type WavePlayerTrackVisualOption = "image" | "waveform" | "scene";

type WavePlayerTrackVisualProps = {
  image: WavePlayerTrack["image"];
  visualization: WavePlayerVisualization;
};

export default function WavePlayerTrackVisual({ image, visualization }: WavePlayerTrackVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visualizationMode] = useState<WavePlayerTrackVisualOption>("waveform");
  const lastDrawRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx || !visualization.waveform) return;

    // Set canvas size once
    if (canvas.width !== 512 || canvas.height !== 512) {
      canvas.width = 512;
      canvas.height = 512;
    }

    const drawWaveform = () => {
      // Throttle to ~60fps
      const now = performance.now();
      if (now - lastDrawRef.current < 16) {
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
        return;
      }
      lastDrawRef.current = now;

      // Clear with background color instead of using clearRect
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      const waveform = visualization.waveform;
      if (!waveform) return;

      // Pre-calculate values
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const halfHeight = height / 2;
      const segmentWidth = width / waveform.length;

      // Draw waveform efficiently
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;

      // Move to start
      const firstY = (waveform[0] / 255) * height;
      ctx.moveTo(0, firstY);

      // Draw lines
      for (let i = 1; i < waveform.length; i++) {
        const x = i * segmentWidth;
        const y = (waveform[i] / 255) * height;
        ctx.lineTo(x, y);
      }

      // Single stroke call
      ctx.stroke();

      // Request next frame
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    // Start animation
    drawWaveform();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visualization.waveform]);

  return (
    <div className="wave-player-track-visual relative w-full">
      {visualizationMode === "image" && (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          className="object-cover"
        />
      )}
      {visualizationMode === "waveform" && (
        <canvas 
          ref={canvasRef}
          className="size-[362px] fill-background border border-muted bg-background"
        />
      )}
    </div>
  );
}

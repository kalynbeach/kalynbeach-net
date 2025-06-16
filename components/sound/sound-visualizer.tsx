"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface SoundVisualizerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function SoundVisualizer({ canvasRef }: SoundVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = 200;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [canvasRef]);

  // Update canvas styles based on theme
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const backgroundColor = resolvedTheme === "dark" ? "oklch(0.145 0 0)" : "oklch(0.9851 0 0)";
      const strokeColor = resolvedTheme === "dark" ? "oklch(0.9851 0 0)" : "oklch(0.145 0 0)";
      ctx.fillStyle = backgroundColor;
      ctx.strokeStyle = strokeColor;
    }
  }, [canvasRef, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className="bg-background relative size-full overflow-hidden rounded-sm border"
    >
      <canvas
        ref={canvasRef}
        className="size-full"
        aria-label="Sound visualization"
      />
    </div>
  );
}

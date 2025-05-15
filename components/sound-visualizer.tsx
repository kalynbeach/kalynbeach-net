"use client";

import type React from "react";

import { useEffect, useRef } from "react";

interface SoundVisualizerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  // theme?: "light" | "dark";
}

export function SoundVisualizer({ canvasRef }: SoundVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  // TODO: useEffect to update canvas styles based on theme
  // useEffect(() => {
  //   if (canvasRef.current) {
  //     const ctx = canvasRef.current.getContext("2d");
  //     if (!ctx) return;
  //     ctx.fillStyle = theme === "light" ? "oklch(0.9851 0 0)" : "oklch(0.0149 0 0)";
  //     ctx.strokeStyle = theme === "light" ? "oklch(0.145 0 0)" : "oklch(0.9851 0 0)";
  //   }
  // }, [canvasRef, theme]);

  return (
    <div
      ref={containerRef}
      className="relative size-full overflow-hidden rounded-sm bg-background border"
    >
      <canvas
        ref={canvasRef}
        className="size-full"
        aria-label="Sound visualization"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWaveformData } from "@/hooks/sound/use-waveform-data";

type WaveformProps = {
  analyser: AnalyserNode | null;
  isInitialized: boolean;
  backgroundColor?: string;
  lineColor?: string;
};

export default function Waveform({
  analyser,
  isInitialized,
  backgroundColor = "#090909",
  lineColor = "#ffffff",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const getWaveformData = useWaveformData(analyser, isInitialized);

  // Memoize canvas setup to avoid unnecessary recalculations
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // Set canvas size based on its display size to prevent scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const context = canvas.getContext("2d", {
      alpha: false, // Optimization: disable alpha when not needed
      desynchronized: true, // Potential performance boost on supported browsers
    });
    if (!context) return false;

    // Store context in ref for reuse
    contextRef.current = context;

    // Set initial styles
    context.lineWidth = 2;
    context.strokeStyle = lineColor;

    return true;
  }, [lineColor]);

  // Memoize draw function to prevent recreating on each render
  const draw = useCallback(() => {
    if (
      !analyser ||
      !isInitialized ||
      !contextRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const context = contextRef.current;
    const canvas = canvasRef.current;
    const dataArray = getWaveformData();

    if (!dataArray?.length) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const sliceWidth = WIDTH / dataArray.length;

    // Clear previous frame using fillRect (faster than clearRect)
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    // Begin new path for waveform
    context.beginPath();

    // Draw waveform
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * HEIGHT) / 2;

      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }

      x += sliceWidth;
    }

    context.lineTo(WIDTH, HEIGHT / 2);
    context.stroke();

    // Request next frame
    animationRef.current = requestAnimationFrame(draw);
  }, [analyser, isInitialized, backgroundColor, getWaveformData]);

  // Handle animation lifecycle
  useEffect(() => {
    let isActive = true;

    const startAnimation = () => {
      if (!setupCanvas()) return;

      const animate = () => {
        if (!isActive) return;
        draw();
      };

      animate();
    };

    if (analyser && isInitialized) {
      startAnimation();
    }

    // Cleanup function
    return () => {
      isActive = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Clear canvas context reference
      contextRef.current = null;
    };
  }, [analyser, isInitialized, setupCanvas, draw]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (setupCanvas() && analyser && isInitialized) {
        draw();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [analyser, isInitialized, setupCanvas, draw]);

  return (
    <div className="waveform w-full h-full border border-primary/60">
      <canvas ref={canvasRef} className="size-full rounded-md" />
    </div>
  );
}

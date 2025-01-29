"use client";

import { useEffect, useRef } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player/context";
import { WavePlayerTrack } from "@/lib/types/wave-player";

// TODO: implement image and R3F scene visual options
type WavePlayerTrackVisualOption = "image" | "waveform" | "scene";

type WavePlayerTrackVisualProps = {
  image: WavePlayerTrack["image"];
};

export default function WavePlayerTrackVisual({ image }: WavePlayerTrackVisualProps) {
  const { state } = useWavePlayerContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !state.visualization.waveform) return;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Draw waveform
      const waveform = state.visualization.waveform;
      if (!waveform) return;

      ctx.beginPath();
      ctx.moveTo(0, ctx.canvas.height / 2);
      
      for (let i = 0; i < waveform.length; i++) {
        const x = (i / waveform.length) * ctx.canvas.width;
        const y = (waveform[i] / 255) * ctx.canvas.height;
        ctx.lineTo(x, y);
      }
      
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawWaveform();
  }, [state.visualization.waveform]);

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-48"
      width={800}
      height={192}
    />
  );
}

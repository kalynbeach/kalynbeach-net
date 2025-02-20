"use client";

import { useEffect, useRef, useState } from "react";
import { useWavePlayerContext } from "@/contexts/wave-player-context";
import { WavePlayerTrack } from "@/lib/types/wave-player";
import Image from "next/image";

// TODO: implement image and R3F scene visual options
type WavePlayerTrackVisualOption = "image" | "waveform" | "scene";

type WavePlayerTrackVisualProps = {
  image: WavePlayerTrack["image"];
};

export default function WavePlayerTrackVisual({ image }: WavePlayerTrackVisualProps) {
  const { state } = useWavePlayerContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visualizationMode, setVisualizationMode] = useState<WavePlayerTrackVisualOption>("waveform");

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
      
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawWaveform();
  }, [state.visualization.waveform]);

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
          className="w-full h-full border border-muted"
          width={512}
          height={512}
        />
      )}
    </div>
  );
}

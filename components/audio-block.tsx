"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AudioContextProvider } from "@/contexts/audio-context";

const WaveFrame = dynamic(() => import("./wave-frame"), { ssr: false });

export default function AudioBlock() {
  return (
    <div className="audio-block w-full flex flex-col items-start justify-start">
      <AudioContextProvider>
        <Suspense fallback={<div>loading...</div>}>
          <WaveFrame />
        </Suspense>
      </AudioContextProvider>
    </div>
  );
}
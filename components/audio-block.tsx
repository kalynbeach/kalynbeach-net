"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const WaveFrame = dynamic(() => import("./wave-frame"), { ssr: false });

export default function AudioBlock() {
  return (
    <div className="audio-block w-full flex flex-col items-start justify-start">
      <Suspense fallback={<div>loading...</div>}>
        <WaveFrame />
      </Suspense>
    </div>
  );
}
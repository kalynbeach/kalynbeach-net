"use client";

import { Suspense, useEffect, useState } from "react";
import WaveFrame from "@/components/sound/wave-frame";
import WavePlayer from "@/components/wave-player/wave-player";
// import {
//   Tabs,
//   TabsContent,
//   TabsList,
//   TabsTrigger,
// } from "@/components/ui/tabs";

export default function SoundBlock() {
  return (
    <div className="sound-block w-full flex flex-col items-center justify-start gap-4">
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <WaveFrame />
      </Suspense>
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <WavePlayer />
      </Suspense>
      {/* <Tabs defaultValue="wave-player" className="w-full h-full font-mono text-sm">
        <TabsList>
          <TabsTrigger value="wave-player">WavePlayer</TabsTrigger>
          <TabsTrigger value="wave-frame">WaveFrame</TabsTrigger>
        </TabsList>
        <TabsContent value="wave-player" className="flex items-center justify-center">
          <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
            <WavePlayer />
          </Suspense>
        </TabsContent>
        <TabsContent value="wave-frame">
          <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
            <WaveFrame />
          </Suspense>
        </TabsContent>
      </Tabs> */}
    </div>
  );
}

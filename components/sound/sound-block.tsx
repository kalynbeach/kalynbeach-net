"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundStream } from "@/hooks/sound/use-sound-stream";
import SoundDevices from "@/components/sound/sound-devices";
import { Badge } from "../ui/badge";

const Waveform = dynamic(() => import("@/components/sound/waveform"), { ssr: false });

export default function SoundBlock() {
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { analyser, isInitialized } = useSoundStream(selectedDevice);

  return (
    <div className="sound-block w-full flex flex-col items-start justify-start gap-2 border rounded-md p-2">
      <div className="w-full flex flex-col-reverse sm:flex-row justify-between sm:items-center gap-2">
        <SoundDevices
          devices={devices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
        />
        <Badge
          variant="outline"
          className={cn(
            "w-14 sm:w-16 justify-center",
            "font-mono text-[10px] sm:text-xs",
            isInitialized && "text-kb-blue dark:text-kb-green"
          )}
        >
          {isInitialized ? "active" : "loading"}
        </Badge>
      </div>
      <Suspense fallback={<div>loading...</div>}>
        <Waveform analyser={analyser} isInitialized={isInitialized} />
      </Suspense>
    </div>
  );
}

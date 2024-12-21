"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundStream } from "@/hooks/sound/use-sound-stream";

const Waveform = dynamic(() => import("@/components/waveform"), { ssr: false });

export default function SoundBlock() {
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { analyser, isInitialized } = useSoundStream(selectedDevice);

  return (
    <div className="sound-block w-full flex flex-col items-start justify-start gap-2 border rounded-md p-2">
      <div className="w-full flex flex-row justify-between items-center border rounded-md p-2">
        <div className="flex flex-row items-center gap-2">
          <p className="font-mono text-sm sm:text-base">{selectedDevice}</p>
          <p className="font-mono text-xs sm:text-sm">{`(${devices.length})`}</p>
        </div>
        <p className={cn("font-mono text-[10px]", isInitialized ? "text-kb-blue dark:text-kb-green" : "")}>
          {isInitialized ? "active" : "idle"}
        </p>
      </div>
      <Suspense fallback={<div>loading...</div>}>
        <Waveform analyser={analyser} isInitialized={isInitialized} />
      </Suspense>
      {/* <ul className="flex flex-col gap-1 border rounded-md p-2">
        {devices.map((device) => (
          <li key={device.deviceId} className="text-xs font-mono">
            {device.label}
          </li>
        ))}
      </ul> */}
      {/* TODO: integrate AudioDevices (as refactored `SoundDevices` component) */}
    </div>
  );
}

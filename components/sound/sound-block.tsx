"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundDeviceStream } from "@/hooks/sound/use-sound-device-stream";
import SoundDevices from "@/components/sound/sound-devices";
import { Badge } from "@/components/ui/badge";

const Waveform = dynamic(() => import("@/components/sound/waveform"), { ssr: false });

export default function SoundBlock() {
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { analyser, isInitialized } = useSoundDeviceStream(selectedDevice);

  return (
    <div className="sound-block w-full flex flex-col items-start justify-start gap-2 border border-border/70 rounded-md p-2">
      <div className="w-full flex flex-col-reverse sm:flex-row justify-between sm:items-center gap-2">
        <SoundDevices
          devices={devices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
        />
        <div className="w-full flex flex-row items-center justify-end">
          <Badge
            variant="outline"
            className={cn(
              "w-16 sm:w-20 justify-center",
              "font-mono font-bold dark:font-normal text-[10px] sm:text-xs",
              isInitialized && "text-kb-blue dark:text-kb-green",
              isInitialized && "bg-neutral-100/10 dark:bg-neutral-900/50",
            )}
          >
            {isInitialized ? "active" : "loading"}
          </Badge>
        </div>
      </div>
      <Waveform
        analyser={analyser}
        isInitialized={isInitialized}
      />
    </div>
  );
}

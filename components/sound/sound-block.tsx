"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundDeviceStream } from "@/hooks/sound/use-sound-device-stream";
import SoundDevices from "@/components/sound/sound-devices";
import { Badge } from "@/components/ui/badge";

const Waveform = dynamic(() => import("@/components/sound/waveform"), { ssr: false });

export default function SoundBlock() {
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { analyser, isInitialized } = useSoundDeviceStream(selectedDevice);
  const { resolvedTheme } = useTheme();

  return (
    <div className="sound-block w-full flex flex-col items-start justify-start gap-2 border-2 border-primary p-2">
      <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center gap-2">
        <SoundDevices
          devices={devices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
        />
        <div className="w-full sm:w-full flex flex-row items-center justify-end">
          <Badge
            variant="outline"
            className={cn(
              "w-16 sm:w-20 justify-center border-muted-foreground/50 bg-muted/30",
              "font-mono font-semibold text-xs",
              isInitialized && "text-kb-blue dark:text-kb-green",
            )}
          >
            {isInitialized ? "active" : "loading"}
          </Badge>
        </div>
      </div>
      <Waveform
        analyser={analyser}
        isInitialized={isInitialized}
        backgroundColor={resolvedTheme === "dark" ? "#090909" : "#ffffff"}
        lineColor={resolvedTheme === "dark" ? "#ffffff" : "#000000"}
      />
    </div>
  );
}

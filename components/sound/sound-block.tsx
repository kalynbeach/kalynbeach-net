"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useSoundContext } from "@/contexts/sound-context";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundDeviceStream } from "@/hooks/sound/use-sound-device-stream";
import { useMeyda } from "@/hooks/sound/use-meyda";
import { Badge } from "@/components/ui/badge";
import SoundDevices from "@/components/sound/sound-devices";
import Chroma from "@/components/sound/chroma";

const Waveform = dynamic(() => import("@/components/sound/waveform"), { ssr: false });

export default function SoundBlock() {
  const { resolvedTheme } = useTheme();
  const { audioContext } = useSoundContext();
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { stream, analyser, isInitialized } = useSoundDeviceStream(selectedDevice);
  const { features } = useMeyda(audioContext, stream);

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
      {features && features.chroma && (
        <Chroma data={features.chroma} />
      )}
    </div>
  );
}

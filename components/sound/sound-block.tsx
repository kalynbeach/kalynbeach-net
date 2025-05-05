"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useSoundContext } from "@/contexts/sound-context";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundDeviceStream } from "@/hooks/sound/use-sound-device-stream";
import { useMeyda } from "@/hooks/sound/use-meyda";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { AudioWaveform, Music } from "lucide-react";
import SoundDevices from "@/components/sound/sound-devices";
import Chroma from "@/components/sound/chroma";
import { WaveformSkeleton } from "@/components/sound/waveform";
import Waveform from "@/components/sound/waveform";

// const Waveform = dynamic(() => import("@/components/sound/waveform"), { ssr: false });

export default function SoundBlock() {
  const { resolvedTheme } = useTheme();
  const { audioContext } = useSoundContext();
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { stream, analyser, isInitialized } = useSoundDeviceStream(selectedDevice);
  const { features, meydaInitializing, meydaError } = useMeyda(audioContext, stream);
  const [activeVisualizers, setActiveVisualizers] = useState<string[]>(["waveform", "chroma"]);

  return (
    <div className="sound-block flex flex-col items-start justify-start gap-2 border border-secondary p-2">
      {/* Sound Block Header */}
      <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center gap-2">
        <SoundDevices
          devices={devices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
        />
        <div className="w-full sm:w-full flex flex-row items-center justify-end gap-2">
          <SoundBlockControls
            activeVisualizers={activeVisualizers}
            setActiveVisualizers={setActiveVisualizers}
          />
          <Badge
            variant="outline"
            className={cn(
              "w-16 sm:w-20 justify-center border-muted bg-muted/30",
              "font-mono font-semibold text-xs",
              isInitialized && !meydaInitializing && !meydaError && "text-kb-blue dark:text-kb-green border-muted-foreground/30",
              meydaInitializing && "text-yellow-500",
              meydaError && "text-red-500"
            )}
          >
            {meydaInitializing ? "loading" : meydaError ? "error" : isInitialized ? "active" : "loading"}
          </Badge>
        </div>
      </div>
      {/* Sound Block Visualizers */}
      <div className="w-full h-[296px] sm:h-[328px] md:h-[360px] lg:h-[456px] flex flex-col justify-between gap-2">
        {activeVisualizers.includes("waveform") ? (
          <Suspense fallback={<WaveformSkeleton />}>
            <Waveform
              analyser={analyser}
              isInitialized={isInitialized}
              backgroundColor={resolvedTheme === "dark" ? "#090909" : "#ffffff"}
              lineColor={resolvedTheme === "dark" ? "#ffffff" : "#000000"}
            />
          </Suspense>
        ) : (
          <WaveformSkeleton />
        )}
        {activeVisualizers.includes("chroma") && features && features.chroma ? (
          <Chroma data={features.chroma} />
        ) : (
          <div className="chroma-skeleton w-full h-16 flex items-center justify-center bg-muted/30 border border-secondary">
            <span className="font-mono text-sm text-muted-foreground">chroma</span>
          </div>
        )}
      </div>
    </div>
  );
}

type SoundBlockControlsProps = {
  activeVisualizers: string[];
  setActiveVisualizers: (activeVisualizers: string[]) => void;
};

function SoundBlockControls({ activeVisualizers, setActiveVisualizers }: SoundBlockControlsProps) {
  return (
    <ToggleGroup type="multiple" variant="outline" value={activeVisualizers} onValueChange={setActiveVisualizers}>
      <ToggleGroupItem
        className="group hover:cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/30 data-[state=on]:border-muted-foreground/30 data-[state=on]:bg-muted/50"
        value="waveform"
        aria-label="Toggle Waveform"
      >
        <AudioWaveform className="h-4 w-4 stroke-muted-foreground group-data-[state=on]:stroke-kb-blue dark:group-data-[state=on]:stroke-kb-green" />
      </ToggleGroupItem>
      <ToggleGroupItem
        className="group hover:cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/30 data-[state=on]:border-muted-foreground/30 data-[state=on]:bg-muted/50"
        value="chroma"
        aria-label="Toggle Chroma"
      >
        <Music className="h-4 w-4 stroke-muted-foreground group-data-[state=on]:stroke-kb-blue dark:group-data-[state=on]:stroke-kb-green" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

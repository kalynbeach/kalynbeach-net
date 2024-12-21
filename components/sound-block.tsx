"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundStream } from "@/hooks/sound/use-sound-stream";

const Canvas = dynamic(() => import("@/components/canvas"), { ssr: false });
const Waveform = dynamic(() => import("@/components/waveform"), { ssr: false });
const FrequencyBars = dynamic(() => import("@/components/frequency-bars"), { ssr: false });

export default function SoundBlock() {
  const { devices, selectedDevice, setSelectedDevice } = useSoundDevices();
  const { analyser, isInitialized } = useSoundStream(selectedDevice);

  return (
    <div className="sound-block w-full flex flex-col items-start justify-start border rounded-md p-2">
      <div className="w-full flex flex-col items-start justify-start gap-2">
        <div className="w-full flex flex-row justify-between items-center">
          <p className="font-mono">device: {selectedDevice}</p>
          <p className="font-mono text-xs">
            {isInitialized ? "initialized" : "idle"}
          </p>
        </div>
        <ul className="flex flex-col gap-1 border rounded-md p-2">
          {devices.map((device) => (
            <li key={device.deviceId} className="text-xs font-mono">
              {device.label}
            </li>
          ))}
        </ul>
        <Suspense fallback={<div>loading...</div>}>
          <div className="w-64 h-64">
            <Canvas>
              {/* <Waveform analyser={analyser} isInitialized={isInitialized} /> */}
              <FrequencyBars analyser={analyser} isInitialized={isInitialized} />
            </Canvas>
          </div>
        </Suspense>
      </div>
    </div>
  );
}

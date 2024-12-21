"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSoundDevices } from "@/hooks/sound/use-sound-devices";
import { useSoundStream } from "@/hooks/sound/use-sound-stream";
// import AudioDevices from "./audio-devices";

// const WaveFrame = dynamic(() => import("./wave-frame"), { ssr: false });

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
        {/* <AudioDevices
          devices={devices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
        /> */}
      </div>
    </div>
  );
}

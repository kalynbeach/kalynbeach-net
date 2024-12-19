"use client";

import { useCallback } from "react";
import { useAudio } from "@/hooks/use-audio";
import AudioDevices from "./audio-devices";

export default function WaveFrame() {
  const { audioDevices, selectedAudioDevice, setSelectedAudioDevice, audioState, error } = useAudio();

  const handleDeviceChange = useCallback((deviceId: string) => {
    const device = audioDevices.find(d => d.deviceId === deviceId);
    if (device) {
      setSelectedAudioDevice(device);
    }
  }, [audioDevices, setSelectedAudioDevice]);

  if (error) {
    return (
      <div className="wave-frame border rounded-md p-2 text-destructive">
        <p>error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="wave-frame w-full sm:w-96 flex flex-col gap-2 border rounded-md p-2">
      <div className="flex flex-row justify-between items-center">
        <p className="text-sm font-mono font-medium">WaveFrame</p>
        <p className="text-[10px] font-mono">{audioState.status}</p>
      </div>
      <AudioDevices
        devices={audioDevices}
        selectedDeviceId={selectedAudioDevice?.deviceId ?? null}
        onDeviceChange={handleDeviceChange}
      />
    </div>
  );
}
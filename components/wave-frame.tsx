"use client";

import { useAudio } from "@/hooks/use-audio";
import AudioDevices from "./audio-devices";

export default function WaveFrame() {
  const { audioDevices, selectedAudioDevice, audioState, error } = useAudio();

  if (error) {
    return (
      <div className="wave-frame border rounded-md p-2 text-destructive">
        <p>error: {error.message}</p>
      </div>
    );
  }

  if (!audioState.context || !audioState.analyzer || !selectedAudioDevice) {
    return (
      <div className="wave-frame border rounded-md p-2">
        <p className="text-xs font-mono">loading...</p>
      </div>
    );
  }

  return (
    <div className="wave-frame border rounded-md p-2">
      <AudioDevices
        devices={audioDevices}
        selectedDeviceId={selectedAudioDevice.deviceId}
        onDeviceChange={deviceId => audioDevices.find(device => device.deviceId === deviceId)?.label}
      />
      {/* Your visualization code here */}
    </div>
  );
}
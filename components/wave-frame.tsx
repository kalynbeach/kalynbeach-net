"use client";

import { use, useEffect } from "react";
import { SoundContext } from "@/contexts/prev-sound-context";
// import { useAudio } from "@/hooks/use-audio";
import AudioDevices from "./audio-devices";

export default function WaveFrame() {
  // const { audioDevices, selectedAudioDevice, setSelectedAudioDevice, audioState, error } = useAudio();
  const sound = use(SoundContext);
  // console.log("[WaveFrame] sound:", sound);

  useEffect(() => {
    if (!sound) return;
    console.log("[WaveFrame useEffect] sound.devices:", sound.devices);
    console.log("[WaveFrame useEffect] sound.activeDevice:", sound.activeDevice);
    // if (!sound.activeDevice) {
    //   sound.setActiveDevice("default");
    // }
  }, []);

  if (!sound || !sound.activeDevice) return null;

  const handleDeviceChange = (deviceId: string) => {
    console.log("[WaveFrame handleDeviceChange] sound:", sound);
    // console.log("[WaveFrame handleDeviceChange] deviceId:", deviceId);
    const device = sound.devices.find(d => d.deviceId === deviceId);
    if (device) {
      sound.setActiveDevice(deviceId);
    }
  };

  // const handleDeviceChange = useCallback((deviceId: string) => {
  //   const device = audioDevices.find(d => d.deviceId === deviceId);
  //   if (device) {
  //     setSelectedAudioDevice(device);
  //   }
  // }, [audioDevices, setSelectedAudioDevice]);

  // if (error) {
  //   return (
  //     <div className="wave-frame border rounded-md p-2 text-destructive">
  //       <p>error: {error.message}</p>
  //     </div>
  //   );
  // }

  return (
    <div className="wave-frame w-full sm:w-96 flex flex-col gap-2 border rounded-md p-2">
      <div className="flex flex-row justify-between items-center">
        <p className="text-sm font-mono font-medium">WaveFrame</p>
        <p className="text-[10px] font-mono">{sound.status}</p>
        {/* <p className="text-[10px] font-mono">{audioState.status}</p> */}
      </div>
      <AudioDevices
        devices={sound.devices}
        selectedDeviceId={sound.activeDevice.deviceId}
        onDeviceChange={handleDeviceChange}
      />
    </div>
  );
}
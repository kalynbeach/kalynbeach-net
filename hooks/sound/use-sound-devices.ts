"use client";

import { useEffect, useState } from "react";
import type { SoundDevicesData } from "@/lib/types";

export function useSoundDevices(): SoundDevicesData {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === "audioinput");
        setDevices(audioDevices);
        
        if (audioDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(audioDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Error accessing audio devices:", error);
      }
    }

    getDevices();
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getDevices);
    };
  }, []);

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
  };
}
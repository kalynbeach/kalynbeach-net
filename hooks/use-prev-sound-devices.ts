"use client";

import { useEffect, useState } from "react";

export async function initializeSoundDevices() {
  let devices: MediaDeviceInfo[] = [];
  let activeDevice: MediaDeviceInfo | null = null;
  console.log("[initializeSoundDevices] initializing devices...");

  try {
    const DEFAULT_DEVICE_LABEL = "Music Audio"; // TODO: make this configurable
    let mediaDevices = await navigator.mediaDevices.enumerateDevices();
    let initialDevices = mediaDevices.filter((device) => device.kind === "audioinput");
    let initialActiveDevice = initialDevices.filter((device) => device.label.includes(DEFAULT_DEVICE_LABEL)).pop();
    if (!initialActiveDevice) {
      initialActiveDevice = initialDevices[0];
    }
    devices = initialDevices;
    activeDevice = initialActiveDevice;
  } catch (error) {
    console.error("[initializeSoundDevices] Error initializing devices:", error);
  }

  console.log("[initializeSoundDevices] devices:", devices);
  console.log("[initializeSoundDevices] activeDevice:", activeDevice);

  return {
    devices,
    activeDevice,
  };
}

export function useSoundDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [activeDevice, setActiveDevice] = useState<MediaDeviceInfo | null>(null);

  // Initialize devices
  useEffect(() => {
    const initDevices = async () => {
      try {
        const { devices, activeDevice } = await initializeSoundDevices();
        setDevices(devices);
        setActiveDevice(activeDevice);

        console.log("[Devices] devices:", devices);
        console.log("[Devices] activeDevice:", activeDevice);
      } catch (error) {
        console.error("[Devices] Error accessing microphone:", error);
      }
    };

    initDevices();
  }, []);

  return {
    devices,
    setDevices,
    activeDevice,
    setActiveDevice,
  };
}
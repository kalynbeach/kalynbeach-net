import { useEffect, useState } from "react";

export function useAudioDevices() {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<MediaDeviceInfo | null>(null);

  useEffect(() => {
    async function getAudioDevices() {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = mediaDevices.filter((device) => device.kind === "audioinput");
        setAudioDevices(audioDevices);
        if (audioDevices.length > 0 && !selectedAudioDevice) {
          const defaultDevice = audioDevices.find(device => device.deviceId === 'default') || audioDevices[0];
          setSelectedAudioDevice(defaultDevice);
        }
      } catch (error) {
        console.error("[useAudioDevices] Error enumerating devices:", error);
      }
    }

    getAudioDevices();
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, [selectedAudioDevice]);

  return {
    audioDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
  };
}
import { useEffect, useState } from "react";

export function useAudioDevices() {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<MediaDeviceInfo | null>(null);

  useEffect(() => {
    async function getAudioDevices() {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = mediaDevices.filter((device) => device.kind === "audiooutput");
        setAudioDevices(audioDevices);
        if (audioDevices.length > 0 && !selectedAudioDevice) {
          // TODO: set initial device based on user preferences
          setSelectedAudioDevice(audioDevices[0]);
        }
      } catch (error) {
        console.error("[useAudioDevices] Error enumerating devices:", error);
      }
    }

    getAudioDevices();
  }, []); // TODO: make sure this dep is correct

  return {
    audioDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
  };
}
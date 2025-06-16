"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface SoundDevice {
  deviceId: string;
  label: string;
  isDefault?: boolean;
}

export interface SoundDeviceSelectProps {
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
  selectedDeviceId?: string;
}

export function SoundDeviceSelect({
  onDeviceChange,
  disabled = false,
  selectedDeviceId,
}: SoundDeviceSelectProps) {
  const [devices, setDevices] = useState<SoundDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Enumerate available audio input devices
  const enumerateDevices = async () => {
    try {
      setIsLoading(true);

      // Request permission first to get labeled devices
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // Stop all tracks immediately - we just needed permission
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn(
            "Could not get initial permission for device labels:",
            err
          );
        });

      const deviceList = await navigator.mediaDevices.enumerateDevices();

      // Filter for audio input devices only and format them
      const inputDevices = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label:
            device.label || `Microphone (${device.deviceId.slice(0, 5)}...)`,
          isDefault: device.deviceId === "default" || device.deviceId === "",
        }));

      setDevices(inputDevices);

      // If no device is selected yet, select the default one
      if (!selectedDeviceId || selectedDeviceId === "") {
        if (inputDevices.length > 0) {
          // Find the default device or use the first one
          const defaultDevice =
            inputDevices.find((d) => d.isDefault) || inputDevices[0];
          onDeviceChange(defaultDevice.deviceId);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error enumerating audio devices:", error);
      setIsLoading(false);
    }
  };

  // Listen for device changes
  useEffect(() => {
    // Initial enumeration
    enumerateDevices();

    // Set up device change listener
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  return (
    <div className="w-full space-y-1">
      <Label
        htmlFor="sound-device-select"
        className="flex cursor-auto items-center gap-1 font-mono text-xs"
        hidden={true}
      >
        <Mic className="h-3 w-3" />
        SoundDeviceSelect
      </Label>
      <Select
        value={selectedDeviceId || ""}
        onValueChange={onDeviceChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger
          id="sound-device-select"
          className="w-full font-mono font-medium"
        >
          <SelectValue
            placeholder={isLoading ? "Loading devices..." : "Select microphone"}
          />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 && (
            <SelectItem value="no-devices" disabled>
              No audio input devices found
            </SelectItem>
          )}
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="font-mono text-sm"
            >
              {device.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface SoundDevicesData {
  devices: MediaDeviceInfo[];
  selectedDevice: string;
  setSelectedDevice: (deviceId: string) => void;
}

export interface SoundContextValue {
  audioContext: AudioContext | null;
}

export interface SoundStreamData {
  analyser: AnalyserNode | null;
  isInitialized: boolean;
}

export interface VisualizerProps {
  analyser: AnalyserNode | null;
  isInitialized: boolean;
}

// NOTE: Previous audio (sound) types

export type AudioError = {
  code: "DEVICE_ACCESS_DENIED" | "DEVICE_NOT_FOUND" | "INITIALIZATION_FAILED";
  message: string;
  originalError?: Error;
};

export type AudioState = {
  status: "idle" | "loading" | "active" | "error";
  context: AudioContext | null;
  analyzer: AnalyserNode | null;
  stream: MediaStream | null;
  timeData: Float32Array;
  frequencyData: Float32Array;
};
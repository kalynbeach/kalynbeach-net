export type SoundStatus = "idle" | "loading" | "active" | "suspended" | "error";

export interface SoundDevicesData {
  devices: MediaDeviceInfo[];
  selectedDevice: string;
  setSelectedDevice: (deviceId: string) => void;
}

export interface SoundContextValue {
  audioContext: AudioContext | null;
  status: SoundStatus;
  error: SoundError | null;
  initialize: () => Promise<void>;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
}

export interface SoundStreamData {
  analyser: AnalyserNode | null;
  isInitialized: boolean;
}

export interface VisualizerProps {
  analyser: AnalyserNode | null;
  isInitialized: boolean;
}

export type SoundError = {
  code: "DEVICE_ACCESS_DENIED" | "DEVICE_NOT_FOUND" | "INITIALIZATION_FAILED";
  message: string;
  originalError?: Error;
};

// NOTE: Previous audio (sound) type
export type AudioState = {
  status: "idle" | "loading" | "active" | "error";
  context: AudioContext | null;
  analyzer: AnalyserNode | null;
  stream: MediaStream | null;
  timeData: Float32Array;
  frequencyData: Float32Array;
};
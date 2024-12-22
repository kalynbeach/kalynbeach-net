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

export interface WavePlayerTrack {
  id: number;
  title: string;
  artist: string;
  record: string;
  src: string;
  image: {
    src: string;
    alt: string;
  };
  isLoop: boolean;
}

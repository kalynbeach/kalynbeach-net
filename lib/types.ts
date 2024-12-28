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

export type WavePlayerState = {
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "error";
  currentTrack: WavePlayerTrack | null;
  currentTime: number;
  duration: number;
  volume: number;
  isLoop: boolean;
  isShuffle: boolean;
  error: Error | null;
};

export type WavePlayerContextValue = {
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  gainNode: GainNode | null;
  sourceNode: AudioBufferSourceNode | null;
  state: WavePlayerState;
  controls: WavePlayerControls;
  playlist: WavePlayerPlaylist;
  initialize: () => Promise<void>;
  cleanup: () => void;
};

export type WavePlayerControls = {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (level: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggleLoop: () => void;
  toggleShuffle: () => void;
};

export type WavePlayerTrack = {
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
};

export type WavePlayerPlaylist = WavePlayerTrack[];

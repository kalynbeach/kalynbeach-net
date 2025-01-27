// Site

export type SiteNavPage = {
  label: string;
  route: string;
};

// Sound

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
  stream: MediaStream | null;
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

// WavePlayer

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

export type WavePlayerPlaylist = {
  id: number;
  title: string;
  tracks: WavePlayerTrack[];
  createdAt: Date;
  updatedAt: Date;
};

export type WavePlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export type WavePlayerState = {
  status: WavePlayerStatus;
  playlist: WavePlayerPlaylist | null;
  track: WavePlayerTrack | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  error: Error | null;
};

export type WavePlayerControls = {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  previous: () => Promise<void>;
  next: () => Promise<void>;
  toggleLoop: () => void;
  setVolume: (level: number) => void;
};

export type WavePlayerContextValue = {
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  gainNode: GainNode | null;
  sourceNode: AudioBufferSourceNode | null;
  state: WavePlayerState;
  controls: WavePlayerControls;
  initialize: () => Promise<void>;
  cleanup: () => void;
};

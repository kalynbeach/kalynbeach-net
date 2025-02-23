export interface WavePlayerBufferPoolState {
  current: AudioBuffer | null;
  next: AudioBuffer | null;
  chunks: Map<string, AudioBuffer>;
  maxPoolSize: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export interface WavePlayerBufferPoolOptions {
  maxPoolSize?: number;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

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

export type WavePlayerAction =
  | { type: "INITIALIZE"; payload: { audioContext: AudioContext } }
  | { type: "SET_BUFFER"; payload: AudioBuffer | null }
  | { type: "SET_TRACK"; payload: WavePlayerTrack | null }
  | { type: "SET_STATUS"; payload: WavePlayerState["status"] }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "SET_ERROR"; payload: Error | null }
  | { type: "SET_VISUALIZATION"; payload: { waveform: Uint8Array | null; frequencies: Uint8Array | null } }
  | { type: "SET_VOLUME"; payload: number }
  | { type: "SET_CURRENT_TIME"; payload: number }
  | { type: "SET_START_TIME"; payload: number }
  | { type: "SET_DURATION"; payload: number }
  | { type: "SET_LOOP"; payload: boolean }
  | { type: "RETRY_LOAD" };

export interface WavePlayerState {
  audioContext: AudioContext | null;
  status: WavePlayerStatus;
  playlist: WavePlayerPlaylist | null;
  currentTrackIndex: number;
  track: WavePlayerTrack | null;
  buffer: AudioBuffer | null;
  bufferProgress: number;
  currentTime: number;
  startTime: number;
  duration: number;
  volume: number;
  visualization: WavePlayerVisualization;
  isMuted: boolean;
  isLooping: boolean;
  error: Error | null;
}

export type WavePlayerVisualization = {
  waveform: Uint8Array | null;
  frequencies: Uint8Array | null;
};

export interface WavePlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setLoop: (loop: boolean) => void;
}

export type WavePlayerContextValue = {
  state: WavePlayerState;
  controls: WavePlayerControls;
  initialize: () => Promise<void>;
  loadTrack: (track: WavePlayerTrack) => Promise<void>;
  retryLoad: () => void;
};

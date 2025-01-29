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

export interface WavePlayerState {
  audioContext: AudioContext | null;
  status: WavePlayerStatus;
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
  // TODO: update with additional controls
  // setLoop: (loop: boolean) => void;
}

export type WavePlayerContextValue = {
  state: WavePlayerState;
  controls: WavePlayerControls;
  initializeAudioContext: () => Promise<void>;
  loadTrack: (track: WavePlayerTrack) => Promise<void>;
  retryLoad: () => void;
};

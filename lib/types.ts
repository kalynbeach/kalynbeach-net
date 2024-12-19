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
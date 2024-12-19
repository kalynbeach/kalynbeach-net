export interface AudioState {
  context: AudioContext | null;
  analyzer: AnalyserNode | null;
  stream: MediaStream | null;
  timeData: Float32Array | null;
  frequencyData: Float32Array | null;
  // features: MeydaFeaturesObject | null;
}
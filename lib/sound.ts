export const defaultAudioContextOptions: AudioContextOptions = {
  sampleRate: 48000,
  latencyHint: "interactive",
};

/**
 * Get an AudioContext instance.
 * @param options - AudioContextOptions
 * @returns AudioContext instance or null if not in browser
 */
export function getAudioContext(
  options: AudioContextOptions = defaultAudioContextOptions
) {
  if (typeof window === "undefined") return null;
  return new AudioContext(options);
}

export const defaultMediaStreamConstraints: MediaStreamConstraints = {
  audio: true,
};

/**
 * Get a MediaStream instance.
 * @param constraints - MediaStreamConstraints
 * @returns MediaStream instance or null if not in browser
 */
export function getMediaStream(
  constraints: MediaStreamConstraints = defaultMediaStreamConstraints
) {
  if (typeof window === "undefined") return null;
  return navigator.mediaDevices.getUserMedia(constraints);
}

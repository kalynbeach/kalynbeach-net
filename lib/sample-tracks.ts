import type { WavePlayerTrack } from "@/components/wave-player/wave-player";

/**
 * The player's tracks until stored tracks replace them. Synthesized,
 * license-free stereo drones from the kkb WavePlayer showcase, copied
 * unchanged into public/samples/wave-player/. Like stored tracks, they carry
 * no duration or peaks, so the player reads both from the files.
 */
export const sampleTracks: readonly WavePlayerTrack[] = [
  ["low-tide", "Low Tide"],
  ["glass-current", "Glass Current"],
  ["night-transit", "Night Transit"],
  ["afterimage", "Afterimage"],
  ["field-recording-07", "Field Recording 07"],
].map(([slug, title]) => ({
  id: slug,
  title,
  src: `/samples/wave-player/${slug}.mp3`,
  artist: "Kalyn Beach",
  record: "Sample Record",
  tag: "Sample",
}));

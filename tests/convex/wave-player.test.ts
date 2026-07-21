import { describe, expect, it } from "vitest";
import {
  toWavePlayerPlaylist,
  toWavePlayerTrack,
} from "@/lib/convex/wave-player";

const track = {
  id: 1,
  title: "0_initializer",
  artist: "Kalyn Beach",
  record: "loops",
  src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
  image: { src: "/icon.svg", alt: "0_initializer" },
  isLoop: true,
};

describe("Convex Wave Player adapter", () => {
  it("preserves the public track contract and S3 URL", () => {
    expect(toWavePlayerTrack(track)).toEqual(track);
  });

  it("converts Convex timestamps to Date instances", () => {
    const playlist = toWavePlayerPlaylist({
      id: 1,
      title: "loops",
      tracks: [track],
      createdAt: 1_742_977_682_462,
      updatedAt: 1_742_977_682_462,
    });

    expect(playlist.createdAt).toEqual(new Date(1_742_977_682_462));
    expect(playlist.updatedAt).toEqual(new Date(1_742_977_682_462));
    expect(playlist.tracks).toEqual([track]);
  });
});

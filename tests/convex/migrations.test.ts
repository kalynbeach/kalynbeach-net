import { describe, expect, it } from "vitest";
import {
  repositorySeedData,
  validateMigrationData,
} from "@/convex/lib/migration";

describe("Convex migration data", () => {
  it("keeps the canonical repository seed exact, valid, and S3-backed", () => {
    expect(() => validateMigrationData(repositorySeedData)).not.toThrow();
    expect(repositorySeedData).toEqual({
      tracks: [
        {
          publicId: 1,
          title: "0_initializer",
          artist: "Kalyn Beach",
          record: "loops",
          src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
          image: { src: "/icon.svg", alt: "0_initializer" },
          isLoop: true,
          createdAt: 1_742_955_735_839,
          updatedAt: 1_742_955_735_839,
        },
        {
          publicId: 2,
          title: "1_workflows",
          artist: "Kalyn Beach",
          record: "loops",
          src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/1_workflows.wav",
          image: { src: "/globe.svg", alt: "1_workflows" },
          isLoop: true,
          createdAt: 1_742_955_802_391,
          updatedAt: 1_742_955_802_391,
        },
      ],
      playlists: [
        {
          publicId: 1,
          title: "loops",
          description: "initial sounds",
          createdAt: 1_743_041_682_462,
          updatedAt: 1_743_041_682_462,
        },
      ],
      playlistTracks: [
        {
          playlistId: 1,
          trackId: 1,
          position: 1,
          createdAt: 1_743_041_907_088,
        },
        {
          playlistId: 1,
          trackId: 2,
          position: 2,
          createdAt: 1_743_041_924_327,
        },
      ],
    });
  });

  it("rejects duplicate public IDs", () => {
    expect(() =>
      validateMigrationData({
        ...repositorySeedData,
        tracks: [...repositorySeedData.tracks, repositorySeedData.tracks[0]],
      })
    ).toThrow("tracks contains duplicate public IDs");
  });

  it("rejects invalid playlist references", () => {
    expect(() =>
      validateMigrationData({
        ...repositorySeedData,
        playlistTracks: [
          {
            ...repositorySeedData.playlistTracks[0],
            trackId: 3,
          },
        ],
      })
    ).toThrow("playlist track references missing track 3");
  });

  it("rejects duplicate playlist positions", () => {
    expect(() =>
      validateMigrationData({
        ...repositorySeedData,
        playlistTracks: [
          repositorySeedData.playlistTracks[0],
          {
            ...repositorySeedData.playlistTracks[1],
            position: 1,
          },
        ],
      })
    ).toThrow("duplicate playlist track position 1:1");
  });
});

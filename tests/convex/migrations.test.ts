import { describe, expect, it } from "vitest";
import { previewSeedData, validateMigrationData } from "@/convex/lib/migration";
import { transformSupabaseProductionData } from "@/lib/migrations/supabase-production";

const source = {
  tracks: [
    {
      id: 1,
      title: "0_initializer",
      artist: "Kalyn Beach",
      record: null,
      src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
      image: null,
      isLoop: true,
      created_at: 1_742_955_735_839,
    },
  ],
  playlists: [
    {
      id: 1,
      title: "loops",
      description: null,
      created_at: 1_743_041_682_462,
    },
  ],
  playlistTracks: [
    {
      id: 1,
      playlist_id: 1,
      track_id: 1,
      position: 1,
      created_at: 1_743_041_907_088,
    },
  ],
};

describe("Convex migration data", () => {
  it("keeps the deterministic preview seed valid and S3-backed", () => {
    expect(() => validateMigrationData(previewSeedData)).not.toThrow();
    expect(previewSeedData.tracks[0].src).toBe(
      "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav"
    );
  });

  it("normalizes nullable production fields before import", () => {
    const transformed = transformSupabaseProductionData(source);

    expect(transformed.tracks[0]).toMatchObject({
      record: "",
      image: { src: "/icon.svg", alt: "0_initializer" },
    });
    expect(transformed.playlists[0]).not.toHaveProperty("description");
  });

  it("rejects duplicate public IDs before import", () => {
    expect(() =>
      transformSupabaseProductionData({
        ...source,
        tracks: [...source.tracks, source.tracks[0]],
      })
    ).toThrow("tracks contains duplicate public IDs");
  });

  it("rejects invalid playlist references before import", () => {
    expect(() =>
      transformSupabaseProductionData({
        ...source,
        playlistTracks: [
          {
            ...source.playlistTracks[0],
            track_id: 2,
          },
        ],
      })
    ).toThrow("playlist track references missing track 2");
  });

  it("rejects duplicate playlist positions before import", () => {
    expect(() =>
      transformSupabaseProductionData({
        tracks: [
          ...source.tracks,
          {
            ...source.tracks[0],
            id: 2,
            title: "1_workflows",
          },
        ],
        playlists: source.playlists,
        playlistTracks: [
          source.playlistTracks[0],
          {
            ...source.playlistTracks[0],
            id: 2,
            track_id: 2,
          },
        ],
      })
    ).toThrow("duplicate playlist track position 1:1");
  });
});

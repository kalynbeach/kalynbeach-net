import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  audioFileProblem,
  MAX_AUDIO_BYTES,
  MAX_PEAKS,
  planAttach,
  toPublicTrack,
  trackAudioProblem,
  type LegacyTrack,
  type StoredTrack,
  type TrackAudio,
} from "@/convex/lib/tracks";
import { repositorySeedData } from "@/convex/lib/migration";

function storageId(value: string): Id<"_storage"> {
  return value as Id<"_storage">;
}

function audio(id: string): TrackAudio {
  return { storageId: storageId(id), duration: 8, peaks: [0.1, 0.5, 1] };
}

const legacyTrack: LegacyTrack = repositorySeedData.tracks[0];

const storedTrack: StoredTrack = {
  publicId: 3,
  title: "stored",
  artist: "Kalyn Beach",
  record: "loops",
  audio: audio("blob-old"),
  createdAt: 100,
  updatedAt: 200,
};

describe("audioFileProblem", () => {
  it.each([
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/flac",
    "AUDIO/MPEG",
    "audio/wav; codecs=1",
  ])("accepts %s", (contentType) => {
    expect(audioFileProblem({ contentType, size: 1024 })).toBeNull();
  });

  it.each([undefined, "", "video/mp4", "audio/ogg", "application/json"])(
    "rejects the content type %s",
    (contentType) => {
      expect(audioFileProblem({ contentType, size: 1024 })).toMatch(
        /Unsupported audio type/
      );
    }
  );

  it("accepts a file at the size limit and rejects one byte more", () => {
    const contentType = "audio/wav";

    expect(audioFileProblem({ contentType, size: MAX_AUDIO_BYTES })).toBeNull();
    expect(
      audioFileProblem({ contentType, size: MAX_AUDIO_BYTES + 1 })
    ).toMatch(/larger than 100 MiB/);
  });

  it("rejects an empty file", () => {
    expect(audioFileProblem({ contentType: "audio/wav", size: 0 })).toBe(
      "Audio file is empty"
    );
  });
});

describe("trackAudioProblem", () => {
  it("accepts a positive duration and peaks between 0 and 1", () => {
    expect(trackAudioProblem({ duration: 8, peaks: [0, 0.5, 1] })).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the duration %s",
    (duration) => {
      expect(trackAudioProblem({ duration, peaks: [0.5] })).toMatch(/duration/);
    }
  );

  it.each([
    ["no peaks", []],
    ["too many peaks", new Array<number>(MAX_PEAKS + 1).fill(0.5)],
    ["a peak above 1", [0.5, 1.2]],
    ["a negative peak", [-0.1]],
    ["a NaN peak", [Number.NaN]],
  ])("rejects %s", (_, peaks) => {
    expect(trackAudioProblem({ duration: 8, peaks })).toMatch(/peaks/);
  });
});

describe("planAttach", () => {
  it("turns a legacy track into a stored track and keeps its identity", () => {
    const plan = planAttach(legacyTrack, audio("blob-new"), 500);

    expect(plan).toEqual({
      kind: "replace",
      next: {
        publicId: 1,
        title: "0_initializer",
        artist: "Kalyn Beach",
        record: "loops",
        createdAt: 1_742_955_735_839,
        updatedAt: 500,
        audio: audio("blob-new"),
      },
      deleteBlob: null,
    });
  });

  it("replaces a stored track's audio and deletes the old blob", () => {
    const plan = planAttach(storedTrack, audio("blob-new"), 500);

    expect(plan).toEqual({
      kind: "replace",
      next: { ...storedTrack, updatedAt: 500, audio: audio("blob-new") },
      deleteBlob: storageId("blob-old"),
    });
  });

  it("treats the same blob again as a retry", () => {
    expect(planAttach(storedTrack, audio("blob-old"), 500)).toEqual({
      kind: "unchanged",
    });
  });
});

describe("toPublicTrack", () => {
  it("returns the WavePlayer track input with the resolved URL", () => {
    expect(
      toPublicTrack(storedTrack, "https://example.convex.cloud/api/storage/1")
    ).toEqual({
      id: "3",
      title: "stored",
      src: "https://example.convex.cloud/api/storage/1",
      artist: "Kalyn Beach",
      record: "loops",
      duration: 8,
      peaks: [0.1, 0.5, 1],
    });
  });
});

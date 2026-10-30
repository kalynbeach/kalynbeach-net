import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { QueryCtx } from "@/convex/_generated/server";
import type { LookConfig } from "@/convex/lib/looks";
import {
  audioFileProblem,
  MAX_AUDIO_BYTES,
  MAX_PEAKS,
  planAttach,
  planSetLook,
  resolvePublicTracks,
  toPublicTrack,
  trackAudioProblem,
  trackMetadataProblems,
  type LegacyTrack,
  type RequestedLook,
  type StoredTrack,
  type Track,
  type TrackAudio,
} from "@/convex/lib/tracks";
import { repositorySeedData } from "@/convex/lib/migration";

const duskConfig: LookConfig = { source: "tones", tones: { x: { hz: 140 } } };

function storageId(value: string): Id<"_storage"> {
  return value as Id<"_storage">;
}

function lookId(value: string): Id<"looks"> {
  return value as Id<"looks">;
}

function audio(id: string): TrackAudio {
  return { storageId: storageId(id), duration: 8, peaks: [0.1, 0.5, 1] };
}

/** Applies a patch the way db.patch does: a shallow merge where undefined removes the field. */
function patched(doc: object, patch: object): object {
  return Object.fromEntries(
    Object.entries({ ...doc, ...patch }).filter(
      ([, value]) => value !== undefined
    )
  );
}

/** The track attachAudio leaves behind and the blob it deletes, or the plan when it writes nothing. */
function attached(track: Track, blob: TrackAudio) {
  const plan = planAttach(track, blob, 500);

  return plan.kind === "patch"
    ? { next: patched(track, plan.patch), deleteBlob: plan.deleteBlob }
    : plan;
}

/** The track setLook leaves behind, or the plan when it writes nothing. */
function setTo(track: Track, requested: RequestedLook) {
  const plan = planSetLook(track, requested, 500);

  return plan.kind === "patch" ? patched(track, plan.patch) : plan;
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

  it.each([undefined, ""])(
    "names a missing type %s as (none)",
    (contentType) => {
      expect(audioFileProblem({ contentType, size: 1024 })).toBe(
        "Unsupported audio type (none)"
      );
    }
  );

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

  it("accepts a readonly peaks array, as the dashboard's read returns", () => {
    const peaks: readonly number[] = Object.freeze([0.25, 1]);

    expect(trackAudioProblem({ duration: 8, peaks })).toBeNull();
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

describe("trackMetadataProblems", () => {
  const fields = (track: Parameters<typeof trackMetadataProblems>[0]) =>
    trackMetadataProblems(track).map((problem) => problem.field);

  it("names a blank title and an empty artist, and allows an empty record", () => {
    expect(fields({ title: "  ", artist: "", record: "" })).toEqual([
      "title",
      "artist",
    ]);
    expect(
      fields({ title: "Low Tide", artist: "Kalyn Beach", record: "" })
    ).toEqual([]);
  });

  it("checks only the fields a partial update sends", () => {
    expect(fields({ record: "" })).toEqual([]);
    expect(fields({ artist: " " })).toEqual(["artist"]);
  });
});

describe("planAttach", () => {
  it("turns a legacy track into a stored track and keeps its identity", () => {
    expect(attached(legacyTrack, audio("blob-new"))).toStrictEqual({
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
    expect(attached(storedTrack, audio("blob-new"))).toStrictEqual({
      next: { ...storedTrack, updatedAt: 500, audio: audio("blob-new") },
      deleteBlob: storageId("blob-old"),
    });
  });

  it("keeps a stored track's look through Replace audio", () => {
    const track = { ...storedTrack, look: lookId("dusk") };

    expect(attached(track, audio("blob-new"))).toStrictEqual({
      next: { ...track, updatedAt: 500, audio: audio("blob-new") },
      deleteBlob: storageId("blob-old"),
    });
  });

  it("keeps a legacy track's look when it converts the track", () => {
    const track = { ...legacyTrack, look: lookId("dusk") };

    expect(attached(track, audio("blob-new"))).toStrictEqual({
      next: {
        publicId: 1,
        title: "0_initializer",
        artist: "Kalyn Beach",
        record: "loops",
        look: lookId("dusk"),
        createdAt: 1_742_955_735_839,
        updatedAt: 500,
        audio: audio("blob-new"),
      },
      deleteBlob: null,
    });
  });

  it("treats the same blob again as a retry", () => {
    expect(attached(storedTrack, audio("blob-old"))).toEqual({
      kind: "unchanged",
    });
  });
});

describe("planSetLook", () => {
  const dusk = { ...storedTrack, look: lookId("dusk") };

  function found(id: string): RequestedLook {
    return { kind: "found", id: lookId(id) };
  }

  it("points a track at a look and stamps updatedAt", () => {
    expect(setTo(storedTrack, found("dusk"))).toStrictEqual({
      ...storedTrack,
      look: lookId("dusk"),
      updatedAt: 500,
    });
  });

  it("moves a track from one look to another", () => {
    expect(setTo(dusk, found("dawn"))).toStrictEqual({
      ...storedTrack,
      look: lookId("dawn"),
      updatedAt: 500,
    });
  });

  it("gives a legacy track a look", () => {
    expect(setTo(legacyTrack, found("dusk"))).toStrictEqual({
      ...legacyTrack,
      look: lookId("dusk"),
      updatedAt: 500,
    });
  });

  it("clears a look by removing the field", () => {
    expect(setTo(dusk, { kind: "none" })).toStrictEqual({
      ...storedTrack,
      updatedAt: 500,
    });
  });

  it("writes nothing when the track already holds what was asked, so a retry converges", () => {
    expect(setTo(dusk, found("dusk"))).toEqual({ kind: "unchanged" });
    expect(setTo(storedTrack, { kind: "none" })).toEqual({
      kind: "unchanged",
    });
  });

  it("refuses a look that is gone with the message the dashboard shows", () => {
    expect(setTo(storedTrack, { kind: "gone", id: lookId("dusk") })).toEqual({
      kind: "refuse",
      message: "Look not found",
    });
  });
});

describe("toPublicTrack", () => {
  const src = "https://example.convex.cloud/api/storage/1";

  it("returns the WavePlayer track input with the resolved URL and the look's config", () => {
    expect(toPublicTrack(storedTrack, src, duskConfig)).toEqual({
      id: "3",
      title: "stored",
      src,
      artist: "Kalyn Beach",
      record: "loops",
      duration: 8,
      peaks: [0.1, 0.5, 1],
      look: duskConfig,
    });
  });

  it("gives a track without a look null", () => {
    expect(toPublicTrack(storedTrack, src, null).look).toBeNull();
  });
});

describe("resolvePublicTracks", () => {
  function stored(publicId: number, look?: string): StoredTrack {
    return {
      ...storedTrack,
      publicId,
      audio: audio(`blob-${publicId}`),
      ...(look ? { look: lookId(look) } : {}),
    };
  }

  function reader(blobs: readonly string[], looks: Record<string, LookConfig>) {
    const lookReads: string[] = [];
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- A fake with only the two reads the resolver may make, so any other read fails the test.
    const ctx = {
      db: {
        get: async (table: string, id: string) => {
          if (table !== "looks") throw new Error(`Read ${table}`);

          lookReads.push(id);

          return Object.hasOwn(looks, id) ? { config: looks[id] } : null;
        },
      },
      storage: {
        getUrl: async (id: string) =>
          blobs.includes(id) ? `https://example.test/${id}` : null,
      },
    } as unknown as Pick<QueryCtx, "db" | "storage">;

    return { ctx, lookReads };
  }

  it("keeps the given order and leaves out legacy tracks and tracks whose blob is gone", async () => {
    const { ctx } = reader(["blob-5", "blob-4"], {});
    const tracks = [stored(5), legacyTrack, stored(3), stored(4)];

    expect(
      (await resolvePublicTracks(ctx, tracks)).map(({ id, src }) => ({
        id,
        src,
      }))
    ).toEqual([
      { id: "5", src: "https://example.test/blob-5" },
      { id: "4", src: "https://example.test/blob-4" },
    ]);
  });

  it("gives each track its look's config, null without one or for a look row that is gone, and reads each look once", async () => {
    const { ctx, lookReads } = reader(
      ["blob-3", "blob-4", "blob-5", "blob-6"],
      {
        dusk: duskConfig,
      }
    );
    const tracks = [
      stored(3, "dusk"),
      stored(4, "dusk"),
      stored(5),
      stored(6, "gone"),
    ];

    expect(
      (await resolvePublicTracks(ctx, tracks)).map((track) => track.look)
    ).toEqual([duskConfig, duskConfig, null, null]);
    expect(lookReads.toSorted()).toEqual(["dusk", "gone"]);
  });
});

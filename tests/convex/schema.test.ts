import type { ValidatorJSON } from "convex/values";
import { describe, expect, it } from "vitest";
import schema from "@/convex/schema";
import { repositorySeedData } from "@/convex/lib/migration";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Whether a document passes a validator, checked against the JSON a schema
 * push sends: an object validator rejects unknown fields, and an optional
 * field may be absent.
 */
function conforms(validator: ValidatorJSON, value: unknown): boolean {
  switch (validator.type) {
    case "null":
      return value === null;
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "id":
      return typeof value === "string";
    case "any":
      return true;
    case "literal":
      return value === validator.value;
    case "array":
      return (
        Array.isArray(value) &&
        value.every((item) => conforms(validator.value, item))
      );
    case "record":
      return (
        isPlainObject(value) &&
        Object.entries(value).every(
          ([key, inner]) =>
            conforms(validator.keys, key) &&
            conforms(validator.values.fieldType, inner)
        )
      );
    case "object":
      return (
        isPlainObject(value) &&
        Object.keys(value).every((key) =>
          Object.hasOwn(validator.value, key)
        ) &&
        Object.entries(validator.value).every(([key, field]) =>
          value[key] === undefined
            ? field.optional
            : conforms(field.fieldType, value[key])
        )
      );
    case "union":
      return validator.value.some((member) => conforms(member, value));
    default:
      throw new Error(`No check for ${validator.type} validators`);
  }
}

/** A table's validator as a schema push sends it. Convex leaves `json` out of its public types. */
function documentType(table: keyof typeof schema.tables): ValidatorJSON {
  const { validator } = schema.tables[table];

  if (!("json" in validator)) {
    throw new Error(`The ${table} validator has no json`);
  }

  return validator.json as ValidatorJSON;
}

const tracks = documentType("tracks");

const storedTrack = {
  publicId: 3,
  title: "Low Tide",
  artist: "Kalyn Beach",
  record: "",
  audio: {
    storageId: "kg2b5j0d1v8x7c3r9m4n6p2q8w1e5t7y",
    duration: 8,
    peaks: [0.1, 0.5, 1],
  },
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
};

describe("schema", () => {
  it("accepts the production seed's legacy tracks", () => {
    expect(
      repositorySeedData.tracks.filter((track) => !conforms(tracks, track))
    ).toEqual([]);
  });

  it("accepts a stored track without a look", () => {
    expect(conforms(tracks, storedTrack)).toBe(true);
  });

  it("accepts a stored track that names a look", () => {
    expect(
      conforms(tracks, {
        ...storedTrack,
        look: "j57a9k3m2x8v1c4b6n0p5q7r2s9t3w1y",
      })
    ).toBe(true);
  });

  it("refuses a track with both src and audio", () => {
    expect(
      conforms(tracks, {
        ...repositorySeedData.tracks[0],
        audio: storedTrack.audio,
      })
    ).toBe(false);
  });

  it("accepts a look and the site row as stored today", () => {
    expect(
      conforms(documentType("looks"), {
        name: "Dusk",
        config: { source: "tones", tones: { x: { hz: 140 } } },
        version: 2,
        createKey: "0b6f7a52-9c1d-4e3b-8f20-5d4c3b2a1908",
        createdAt: 1_760_000_000_000,
        updatedAt: 1_760_000_100_000,
      })
    ).toBe(true);
    expect(
      conforms(documentType("site"), {
        liveLook: "j57a9k3m2x8v1c4b6n0p5q7r2s9t3w1y",
      })
    ).toBe(true);
  });
});

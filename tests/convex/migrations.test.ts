import { describe, expect, it } from "vitest";
import {
  previewSamples,
  renderSampleWav,
  seedsSampleLook,
  seedsSampleTrack,
  SAMPLE_PEAKS,
  SAMPLE_RATE,
  SAMPLE_SECONDS,
} from "@/convex/lib/migration";
import { audioFileProblem, trackAudioProblem } from "@/convex/lib/tracks";
import { seedPreview } from "@/convex/migrations";
import { lookNameProblem, planCreate } from "@/convex/lib/looks";
import {
  DEFAULT_WAVEFORM_CONFIG,
  applyPreset,
  parseWaveformConfig,
} from "@/components/waveform/settings";

describe("preview samples", () => {
  it("render a 16-bit mono WAV whose duration and peaks pass the upload rules", () => {
    const { wav, duration, peaks } = renderSampleWav(previewSamples[0]);
    const view = new DataView(wav.buffer);
    const ascii = (offset: number) =>
      String.fromCharCode(...wav.subarray(offset, offset + 4));
    const frames = SAMPLE_RATE * SAMPLE_SECONDS;

    expect(ascii(0)).toBe("RIFF");
    expect(ascii(8)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(frames * 2);
    expect(wav.byteLength).toBe(44 + frames * 2);
    expect(duration).toBe(SAMPLE_SECONDS);
    expect(peaks).toHaveLength(SAMPLE_PEAKS);
    expect(Math.max(...peaks)).toBeGreaterThan(0.5);
    expect(trackAudioProblem({ duration, peaks })).toBeNull();
    expect(
      audioFileProblem({ contentType: "audio/wav", size: wav.byteLength })
    ).toBeNull();
  });

  it("render the same bytes every time and a different tone per sample", () => {
    const [first, second] = previewSamples.map(renderSampleWav);

    expect(renderSampleWav(previewSamples[0]).wav).toEqual(first.wav);
    expect(second.wav).not.toEqual(first.wav);
  });

  it("each carry a saved look the player draws as its own figure", () => {
    const [a, b] = previewSamples.map((sample) =>
      parseWaveformConfig(sample.look.config)
    );
    const rosette = applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette");
    const corners = applyPreset(DEFAULT_WAVEFORM_CONFIG, "corners");

    expect(a).toEqual(rosette);
    expect(b).toEqual({
      ...corners,
      look: { ...corners.look, color: "flame" },
    });
    expect(a).not.toEqual(DEFAULT_WAVEFORM_CONFIG);
    expect(b).not.toEqual(a);
  });

  it("each look passes the dashboard's create rules under its own key", () => {
    const keys = previewSamples.map((sample) => sample.look.createKey);

    expect(new Set(keys).size).toBe(keys.length);
    for (const sample of previewSamples) {
      expect(lookNameProblem(sample.look.name)).toBeNull();
      expect(planCreate(null, sample.look).kind).toBe("insert");
    }
  });
});

describe("seedPreview's look for an existing sample track", () => {
  it("gives the look in the run that creates it, to a track with none", () => {
    expect(seedsSampleLook({}, true)).toBe(true);
  });

  it("keeps a look cleared on the dashboard when the seed reruns", () => {
    expect(seedsSampleLook({}, false)).toBe(false);
  });

  it("never replaces a look chosen on the dashboard", () => {
    expect(seedsSampleLook({ look: "chosen" }, true)).toBe(false);
    expect(seedsSampleLook({ look: "chosen" }, false)).toBe(false);
  });
});

describe("seedPreview's sample tracks", () => {
  it("inserts every sample on a deployment that has removed no track", () => {
    for (const sample of previewSamples) {
      expect(seedsSampleTrack(sample.publicId, null)).toBe(true);
    }
  });

  it("never gives a sample the publicId of a removed track or one below it", () => {
    expect(seedsSampleTrack(4, { highest: 4 })).toBe(false);
    expect(seedsSampleTrack(3, { highest: 4 })).toBe(false);
  });

  it("inserts a sample above the highest removed publicId", () => {
    expect(seedsSampleTrack(4, { highest: 3 })).toBe(true);
  });
});

type Row = Record<string, unknown>;
type Tables = Record<"tracks" | "looks" | "retiredTrackIds", Row[]>;

/** The slice of a Convex mutation context that seedPreview uses, over arrays. */
function seedContext(tables: Tables) {
  let issued = 0;

  return {
    db: {
      query: (table: keyof Tables) => ({
        withIndex(
          _name: string,
          range: (query: { eq(field: string, value: unknown): unknown }) => void
        ) {
          const wanted: [string, unknown][] = [];
          const query = {
            eq(field: string, value: unknown) {
              wanted.push([field, value]);
              return query;
            },
          };
          range(query);

          return {
            unique: async () =>
              tables[table].find((row) =>
                wanted.every(([field, value]) => row[field] === value)
              ) ?? null,
          };
        },
        unique: async () => tables[table][0] ?? null,
      }),
      insert: async (table: keyof Tables, row: Row) => {
        const _id = `${table}:${issued++}`;
        tables[table].push({ _id, ...row });
        return _id;
      },
      patch: async (table: keyof Tables, id: string, patch: Row) => {
        Object.assign(tables[table].find((row) => row._id === id) ?? {}, patch);
      },
    },
    storage: { store: async () => `blob:${issued++}` },
  };
}

function runSeed(tables: Tables): Promise<{ tracks: number; looks: number }> {
  // Convex keeps the registered handler here. Calling it skips only the
  // argument and return validation a deployment adds.
  const handler: unknown = Reflect.get(seedPreview, "_handler");

  if (typeof handler !== "function") {
    throw new Error("seedPreview has no handler");
  }

  return handler(seedContext(tables), {});
}

describe("seedPreview", () => {
  it("seeds every sample with its look on a new deployment, and nothing on a rerun", async () => {
    const tables: Tables = { tracks: [], looks: [], retiredTrackIds: [] };

    expect(await runSeed(tables)).toEqual({
      tracks: previewSamples.length,
      looks: previewSamples.length,
    });
    expect(tables.tracks.map((track) => track.publicId)).toEqual(
      previewSamples.map((sample) => sample.publicId)
    );
    expect(await runSeed(tables)).toEqual({ tracks: 0, looks: 0 });
  });

  it("leaves removed samples removed when it reruns, and makes no look for them", async () => {
    const highest = Math.max(
      ...previewSamples.map((sample) => sample.publicId)
    );
    const tables: Tables = {
      tracks: [],
      looks: [],
      retiredTrackIds: [{ highest }],
    };

    expect(await runSeed(tables)).toEqual({ tracks: 0, looks: 0 });
    expect(tables.tracks).toEqual([]);
    expect(tables.looks).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  previewSamples,
  renderSampleWav,
  seedsSampleLook,
  SAMPLE_PEAKS,
  SAMPLE_RATE,
  SAMPLE_SECONDS,
} from "@/convex/lib/migration";
import { audioFileProblem, trackAudioProblem } from "@/convex/lib/tracks";
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
      expect(planCreate(null, sample.look, 0).kind).toBe("insert");
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

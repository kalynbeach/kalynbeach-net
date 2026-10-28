import { describe, expect, it } from "vitest";
import {
  previewSamples,
  renderSampleWav,
  repositorySeedData,
  SAMPLE_PEAKS,
  SAMPLE_RATE,
  SAMPLE_SECONDS,
  validateMigrationData,
} from "@/convex/lib/migration";
import { audioFileProblem, trackAudioProblem } from "@/convex/lib/tracks";

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

describe("preview samples", () => {
  it("never reuse a production track's public ID", () => {
    const ids = [
      ...repositorySeedData.tracks.map((track) => track.publicId),
      ...previewSamples.map((sample) => sample.publicId),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

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
});

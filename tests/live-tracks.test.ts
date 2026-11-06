import { describe, expect, it } from "vitest";
import type { PublicTrack } from "@/convex/lib/tracks";
import { settleTracks } from "@/components/site/live-tracks";
import { DEFAULT_LOOK, currentLook } from "@/components/wave-player/look";
import { parsePlaylist } from "@/components/wave-player/playlist";
import {
  applyPreset,
  DEFAULT_WAVEFORM_CONFIG,
  parseWaveformConfig,
  type WaveformConfig,
} from "@/components/waveform/settings";

/** A config as Convex stores and returns it: plain JSON. */
function stored(config: WaveformConfig): NonNullable<PublicTrack["look"]> {
  return JSON.parse(JSON.stringify(config));
}

const circle = stored(applyPreset(DEFAULT_WAVEFORM_CONFIG, "circle"));
const rosette = stored(applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette"));

function row(id: number, look: PublicTrack["look"]): PublicTrack {
  return {
    id: String(id),
    title: `Track ${id}`,
    src: `https://example.com/${id}.mp3`,
    artist: "Kalyn Beach",
    record: "Rework",
    duration: 120,
    peaks: [0, 0.5, 1],
    look,
  };
}

/** The same rows as a new answer: new arrays and objects, same content. */
function again(rows: readonly PublicTrack[]): PublicTrack[] {
  return JSON.parse(JSON.stringify(rows));
}

/** What the WavePlayer block makes of the site's tracks. */
function played(rows: readonly PublicTrack[]) {
  const { playlist, issues } = parsePlaylist(settleTracks(null, rows).tracks);

  return { looks: playlist.tracks.map((track) => track.look), issues };
}

describe("settleTracks hands the player each track's saved look", () => {
  it("passes a saved look as the stored config itself", () => {
    const [track] = settleTracks(null, [row(1, circle)]).tracks;

    expect(track.look).toEqual(circle);
  });

  it("gives the player each track's own look, set to draw the audio", () => {
    const { looks, issues } = played([row(1, circle), row(2, rosette)]);

    expect(issues).toEqual([]);
    expect(looks[0]).toMatchObject({ ...circle, source: "audio" });
    expect(looks[1]).toMatchObject({ ...rosette, source: "audio" });
    expect(looks[0]).not.toEqual(looks[1]);
  });

  it("draws the block's default player look for a track without a look", () => {
    const { looks, issues } = played([row(1, null)]);

    expect(issues).toEqual([]);
    expect(looks[0]).toBeNull();
    expect(currentLook(looks[0] ?? null, null)).toBe(DEFAULT_LOOK);
  });

  it("keeps a malformed look drawable instead of dropping the track", () => {
    const malformed = {
      tones: "loud",
      forms: [3],
      motion: { speed: "fast" },
      display: null,
    };
    const { looks, issues } = played([row(1, malformed)]);

    expect(issues).toEqual([]);
    expect(parseWaveformConfig(looks[0] ?? {})).toEqual({
      ...parseWaveformConfig(malformed),
      source: "audio",
    });
  });
});

describe("settleTracks keeps objects while their content holds", () => {
  const rows = [row(1, circle), row(2, rosette), row(3, null)];

  it("returns the same tracks for a new answer with the same content", () => {
    const first = settleTracks(null, rows);
    const second = settleTracks(first, again(rows));

    expect(second.tracks).toBe(first.tracks);
  });

  it("returns what it holds when the answer is the same array", () => {
    const first = settleTracks(null, rows);

    expect(settleTracks(first, rows)).toBe(first);
  });

  it("keeps an edited track's look and the other tracks", () => {
    const first = settleTracks(null, rows);
    const edited = again(rows);
    edited[0] = { ...edited[0], title: "Renamed" };
    const second = settleTracks(first, edited);

    expect(second.tracks).not.toBe(first.tracks);
    expect(second.tracks[0]).not.toBe(first.tracks[0]);
    expect(second.tracks[0].title).toBe("Renamed");
    expect(second.tracks[0].look).toBe(first.tracks[0].look);
    expect(second.tracks[1]).toBe(first.tracks[1]);
    expect(second.tracks[2]).toBe(first.tracks[2]);
  });

  it("shares one look object between tracks with the same look", () => {
    const { tracks } = settleTracks(null, [row(1, circle), row(2, circle)]);

    expect(tracks[1].look).toBe(tracks[0].look);
  });

  it("gives a track a new look when its look changes", () => {
    const first = settleTracks(null, rows);
    const changed = again(rows);
    changed[0] = { ...changed[0], look: rosette };
    const second = settleTracks(first, changed);

    expect(second.tracks[0].look).toBe(first.tracks[1].look);
    expect(second.tracks[0].look).not.toBe(first.tracks[0].look);
  });

  it("drops a track's look when its look is cleared", () => {
    const first = settleTracks(null, rows);
    const cleared = again(rows);
    cleared[0] = { ...cleared[0], look: null };

    expect(settleTracks(first, cleared).tracks[0].look).toBeNull();
  });
});

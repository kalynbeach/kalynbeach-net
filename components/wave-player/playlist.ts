import { toSeconds, type Seconds } from "@/lib/audio";

import { toPeaks, type Peaks } from "./peaks";

/** One track as a site passes it. */
export type WavePlayerTrack = {
  /** Stable and unique within the list. The current track and the caches follow it. */
  readonly id: string;
  readonly title: string;
  /**
   * An absolute or page-relative URL. A cross-origin host must send
   * Access-Control-Allow-Origin, or the track fails to load.
   */
  readonly src: string;
  readonly artist?: string;
  /** The album, shown after the artist and sent to Media Session as the album. */
  readonly record?: string;
  /** The mini player's short label, such as "Sample". */
  readonly tag?: string;
  /** Seconds, when known ahead. Saves a metadata request per track. */
  readonly duration?: number;
  /** An amplitude overview, 0 to 1, any length. Saves a download and a decode. */
  readonly peaks?: readonly number[];
};

/** A checked track. Optional fields are null, never undefined. */
export type Track = {
  readonly id: string;
  readonly title: string;
  readonly src: string;
  readonly artist: string | null;
  readonly record: string | null;
  readonly tag: string | null;
  readonly duration: Seconds | null;
  readonly peaks: Peaks | null;
};

export type Playlist = {
  readonly tracks: readonly Track[];
  /** Each id's position, so a row click is one lookup. */
  readonly indexOf: ReadonlyMap<string, number>;
  /** The content. Two playlists with one key are the same list, so a fresh array of the same tracks changes nothing. */
  readonly key: string;
};

export type PlaylistIssue =
  | {
      readonly kind: "missing-field";
      /** The record's position in the input. */
      readonly at: number;
      readonly field: "id" | "title" | "src";
    }
  | { readonly kind: "duplicate-id"; readonly at: number; readonly id: string }
  | { readonly kind: "bad-src"; readonly id: string }
  | { readonly kind: "bad-duration"; readonly id: string }
  | { readonly kind: "bad-peaks"; readonly id: string };

/** A fixed base, so the server and the client accept the same src strings. */
const PARSE_BASE = "https://wave-player.invalid/";

export type ParsedPlaylist = {
  readonly playlist: Playlist;
  readonly issues: readonly PlaylistIssue[];
};

export function parsePlaylist(
  input: readonly WavePlayerTrack[]
): ParsedPlaylist {
  const tracks: Track[] = [];
  const indexOf = new Map<string, number>();
  const issues: PlaylistIssue[] = [];

  input.forEach((record, at) => {
    const id = record.id.trim();
    const title = record.title.trim();
    const src = record.src.trim();

    const missing =
      id === "" ? "id" : title === "" ? "title" : src === "" ? "src" : null;

    if (missing) {
      issues.push({ kind: "missing-field", at, field: missing });

      return;
    }

    if (indexOf.has(id)) {
      issues.push({ kind: "duplicate-id", at, id });

      return;
    }

    if (!URL.canParse(src, PARSE_BASE)) {
      issues.push({ kind: "bad-src", id });

      return;
    }

    const duration =
      record.duration !== undefined &&
      Number.isFinite(record.duration) &&
      record.duration > 0
        ? toSeconds(record.duration)
        : null;

    if (record.duration !== undefined && duration === null)
      issues.push({ kind: "bad-duration", id });

    const peaks = record.peaks === undefined ? null : toPeaks(record.peaks);

    if (record.peaks !== undefined && peaks === null)
      issues.push({ kind: "bad-peaks", id });

    indexOf.set(id, tracks.length);
    tracks.push({
      id,
      title,
      src,
      artist: record.artist?.trim() || null,
      record: record.record?.trim() || null,
      tag: record.tag?.trim() || null,
      duration,
      peaks,
    });
  });

  return {
    playlist: { tracks, indexOf, key: JSON.stringify(tracks) },
    issues,
  };
}

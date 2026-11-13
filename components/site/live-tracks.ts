import { useQueries } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { news } from "@/components/site/seed";
import type { PublicTrack } from "@/convex/lib/tracks";
import type {
  WavePlayerLook,
  WavePlayerTrack,
} from "@/components/wave-player/wave-player";

/** A look as tracks.list sends it: the saved config, as stored. */
type StoredLook = NonNullable<PublicTrack["look"]>;

/** Module scope, so the request never changes and the subscription never restarts. */
const TRACKS = { tracks: { query: api.tracks.list, args: {} } };

/**
 * tracks.list for the site's one WavePlayerProvider, live:
 *
 *   // components/site/shell.tsx
 *   const tracks = useLiveTracks(seed?.tracks);
 *   <WavePlayerProvider tracks={tracks ?? NO_TRACKS}>
 *
 * null until the first list arrives, so the shell can draw the player's
 * skeleton instead of an empty player. `seed` is the root layout's read,
 * undefined until it streams in. The subscription's answers
 * replace it, so an open tab follows the admin's uploads, replacements, and
 * removals without a reload. A query still subscribing, reconnecting, or
 * failing is no news: useQueries returns a failure as a value, and the hook
 * keeps the last list it had, so the player never falls back to an older one.
 */
export function useLiveTracks(
  seed: readonly PublicTrack[] | undefined
): readonly WavePlayerTrack[] | null {
  const result: PublicTrack[] | Error | undefined = useQueries(TRACKS).tracks;
  const [held, setHeld] = useState<SettledTracks | null>(null);
  const rows = news(
    Array.isArray(result) ? result : undefined,
    seed,
    held !== null
  );
  const next = rows === undefined ? held : settleTracks(held, rows);

  // The client returns one array per answer, so this settles in one render.
  if (next !== held) setHeld(next);

  return next?.tracks ?? null;
}

/**
 * The player's tracks for one tracks.list answer, and what the next answer
 * needs to reuse them. Invariant: each key in the maps names one object,
 * which the next answer reuses while that content holds.
 */
export type SettledTracks = {
  /** The answer these tracks came from. */
  readonly rows: readonly PublicTrack[];
  readonly tracks: readonly WavePlayerTrack[];
  /** By the row's JSON. */
  readonly byRow: ReadonlyMap<string, WavePlayerTrack>;
  /** By the stored config's JSON. */
  readonly byLook: ReadonlyMap<string, WavePlayerLook>;
};

/**
 * The player's tracks for `rows`, keeping `previous`'s objects while their
 * content holds. Convex sends a new array of new rows on every answer, and a
 * new look object costs the block a fresh check; a new track list costs the
 * provider a playlist pass. So an answer with the same content returns the
 * same tracks array, an edited track keeps its look object, and two tracks
 * with one look share it.
 */
export function settleTracks(
  previous: SettledTracks | null,
  rows: readonly PublicTrack[]
): SettledTracks {
  if (previous?.rows === rows) return previous;

  const byRow = new Map<string, WavePlayerTrack>();
  const byLook = new Map<string, WavePlayerLook>();
  const lookFor = (stored: StoredLook) => {
    const key = JSON.stringify(stored);
    const look = byLook.get(key) ?? previous?.byLook.get(key) ?? stored;

    byLook.set(key, look);

    return look;
  };
  const tracks = rows.map((row) => {
    const key = JSON.stringify(row);
    const look = row.look && lookFor(row.look);
    const track = previous?.byRow.get(key) ?? { ...row, look };

    byRow.set(key, track);

    return track;
  });
  const same =
    previous !== null &&
    tracks.length === previous.tracks.length &&
    tracks.every((track, at) => track === previous.tracks[at]);

  return { rows, tracks: same ? previous.tracks : tracks, byRow, byLook };
}

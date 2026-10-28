"use client";

import { useQueries } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { PublicTrack } from "@/convex/lib/tracks";
import type { WavePlayerTrack } from "@/components/wave-player/wave-player";

/** Module scope, so the request never changes and the subscription never restarts. */
const TRACKS = { tracks: { query: api.tracks.list, args: {} } };

/**
 * tracks.list for the site's one WavePlayerProvider, live:
 *
 *   // app/layout.tsx
 *   <SiteShell tracks={await fetchPublicQuery(api.tracks.list, {}, [])}>
 *
 *   // components/site/shell.tsx
 *   <WavePlayerProvider tracks={useLiveTracks(tracks)}>
 *
 * `initial` is the root layout's read, so first paint draws the real list.
 * After hydration the subscription's answers replace it, so an open tab
 * follows the admin's uploads, replacements, and removals without a reload.
 * A query still subscribing, reconnecting, or failing is no news: useQueries
 * returns a failure as a value, and the hook keeps the last list it had, so
 * the player never falls back to an older one.
 */
export function useLiveTracks(
  initial: readonly WavePlayerTrack[]
): readonly WavePlayerTrack[] {
  const result: PublicTrack[] | Error | undefined = useQueries(TRACKS).tracks;
  const [held, setHeld] = useState(initial);
  const next = Array.isArray(result) ? result : held;

  // The client returns one array per answer, so this settles in one render.
  if (next !== held) setHeld(next);

  return next;
}

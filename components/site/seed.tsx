"use client";

import { createContext, use, useEffect } from "react";
import type { PublicTrack } from "@/convex/lib/tracks";
import type { StoredValue } from "@/components/waveform/settings";

/** The root layout's two Convex reads, as the shell receives them. */
export type ShellSeed = {
  readonly tracks: readonly PublicTrack[];
  readonly liveLook: StoredValue;
};

/** The shell's setter for the seed. Only the shell provides it. */
export const SeedContext = createContext<(seed: ShellSeed) => void>(() => {});

/**
 * Hands the root layout's reads to the shell. They only seed the player and
 * the waveform; the subscriptions keep both live after.
 */
export function Seed({ tracks, liveLook }: ShellSeed) {
  const deliver = use(SeedContext);

  useEffect(() => deliver({ tracks, liveLook }), [deliver, tracks, liveLook]);

  return null;
}

/**
 * What a live hook settles this render. The subscription's answer wins
 * whenever there is one. The seed counts only while the hook holds nothing,
 * since it is the older read and must never replace a newer answer.
 * undefined means no news.
 */
export function news<T>(
  answer: T | undefined,
  seed: T | undefined,
  holding: boolean
): T | undefined {
  if (answer !== undefined) return answer;

  return holding ? undefined : seed;
}

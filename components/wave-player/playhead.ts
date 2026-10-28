"use client";

/*
 * The current track's position, for the parts that draw it.
 *
 * Position is not part of the store's snapshot, which would re-render every
 * view each frame. A part reads it with usePlayhead(playhead, select) and
 * re-renders only when its selected value changes: whole seconds for a time
 * readout, the played-bar count for a seek bar, one device pixel of the
 * mobile bar's progress line.
 *
 * While a track plays, the store samples the file handle once per animation
 * frame and notifies; otherwise it samples on a seek, a track change, or a
 * status change. The bar's Progress indicator also eases between its steps
 * with its CSS width transition, which Kevelle's reduced-motion rule
 * shortens to nothing.
 */

import * as React from "react";

import type { Seconds } from "@/lib/audio";

export interface Playhead {
  /** Seconds into the current track at the last sample. The same value until the next notification. */
  position(): Seconds;
  subscribe(listener: () => void): () => void;
}

/** A playhead that holds `position`, for the states workbench and tests. */
export function stillPlayhead(position: Seconds): Playhead {
  return { position: () => position, subscribe: () => () => {} };
}

/**
 * `select(position)`, re-rendering the caller only when it changes. `select`
 * returns a primitive, so an unchanged value skips the render.
 */
export function usePlayhead<T extends string | number | boolean>(
  playhead: Playhead,
  select: (position: Seconds) => T
): T {
  const read = () => select(playhead.position());

  return React.useSyncExternalStore(playhead.subscribe, read, read);
}

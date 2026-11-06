"use client";

/*
 * Time readouts. Each subscribes to the playhead at whole seconds, so it
 * renders once a second while playing and never for the frames between.
 * They are plain text, not live regions: the seek slider's aria-valuetext
 * carries the position, and the provider's live region carries status.
 * The elapsed time changes, so it sets in signal-bright in dark, as the
 * oscilloscope's and Binaural Beats' readings do. Fixed times stay muted.
 */

import { cn } from "cn";

import type { Seconds } from "@/lib/audio";

import { UNKNOWN_TIME, formatClock, formatRemaining } from "./format";
import { usePlayhead, type Playhead } from "./playhead";

const wholeSeconds = (position: Seconds) => Math.floor(position);

type ReadoutProps = {
  readonly playhead: Playhead;
  /** False after a failure, which draws --:--. */
  readonly known: boolean;
  /** A drag in progress, which the readout shows in place of the position. */
  readonly preview?: number | null;
};

export function Elapsed({ playhead, known, preview = null }: ReadoutProps) {
  const second = usePlayhead(playhead, wholeSeconds);

  return (
    <span className="type-pixel text-foreground dark:text-signal-bright tabular-nums">
      {known ? formatClock(preview ?? second) : UNKNOWN_TIME}
    </span>
  );
}

export function Remaining({
  playhead,
  known,
  preview = null,
  duration,
}: ReadoutProps & { readonly duration: Seconds | null }) {
  const second = usePlayhead(playhead, wholeSeconds);

  return (
    <span className="type-pixel text-muted-foreground tabular-nums">
      {known ? formatRemaining(preview ?? second, duration) : UNKNOWN_TIME}
    </span>
  );
}

/** Elapsed time's type role per view: the bar's line of text, or the mini player's large reading. */
const ELAPSED = {
  bar: "type-pixel",
  mini: "type-pixel-2x",
} as const satisfies Record<"bar" | "mini", string>;

/** Elapsed over the duration, the bar's and the mini player's one readout. */
export function Clock({
  playhead,
  known,
  duration,
  size,
}: ReadoutProps & {
  readonly duration: Seconds | null;
  readonly size: keyof typeof ELAPSED;
}) {
  const second = usePlayhead(playhead, wholeSeconds);

  return (
    <span className="flex items-baseline tabular-nums">
      <span
        className={cn(ELAPSED[size], "text-foreground dark:text-signal-bright")}
      >
        {known ? formatClock(second) : UNKNOWN_TIME}
      </span>
      <span className="type-pixel text-muted-foreground whitespace-pre">
        {` / ${known ? formatClock(duration) : UNKNOWN_TIME}`}
      </span>
    </span>
  );
}

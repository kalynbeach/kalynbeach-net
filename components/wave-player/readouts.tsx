"use client";

/*
 * Time readouts. Each subscribes to the playhead at whole seconds, so it
 * renders once a second while playing and never for the frames between.
 * They are plain text, not live regions: the seek slider's aria-valuetext
 * carries the position, and the provider's live region carries status.
 * The elapsed time changes, so it sets in signal-bright in dark, as the
 * oscilloscope's and Binaural Beats' readings do. Fixed times stay muted.
 */

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

/** The mobile bar's one readout. */
export function Clock({
  playhead,
  known,
  duration,
}: ReadoutProps & { readonly duration: Seconds | null }) {
  const second = usePlayhead(playhead, wholeSeconds);

  return (
    <span className="type-pixel tabular-nums">
      <span className="text-foreground dark:text-signal-bright">
        {known ? formatClock(second) : UNKNOWN_TIME}
      </span>
      <span className="text-muted-foreground">
        {` / ${known ? formatClock(duration) : UNKNOWN_TIME}`}
      </span>
    </span>
  );
}

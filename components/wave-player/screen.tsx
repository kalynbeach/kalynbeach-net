import { useMemo, type ReactNode } from "react";
import { cn } from "cn";

import {
  STILL_STROKE,
  STILL_VIEWBOX,
  stillPaths,
  type WavePlayerStill,
} from "./look";

export type ScreenSize = "card" | "mini" | "bar";

/** The card's box squares to its content width; the mini player's is 72px and the bar's 36px. */
const BOX = {
  card: "aspect-square w-full",
  mini: "size-18",
  bar: "size-9",
} as const satisfies Record<ScreenSize, string>;

/**
 * The slot's content fills the box and stays mounted in every status, so a
 * waveform never restarts when a track pauses, loads, or fails. `overlay`
 * covers it without replacing it.
 */
export function Screen({
  size,
  still,
  overlay,
  children,
}: {
  readonly size: ScreenSize;
  /** The current look's still, drawn while the slot is empty. */
  readonly still: WavePlayerStill;
  /** Absolutely placed content over the slot, such as a spinner or a failure. */
  readonly overlay?: ReactNode;
  /** What the box shows, such as a live frame's dock of the provider's screen. Absent: the still figure. */
  readonly children?: ReactNode;
}) {
  return (
    <div
      data-slot="wave-player-screen"
      className={cn(
        "dark relative shrink-0 overflow-hidden border border-input bg-background text-foreground",
        BOX[size]
      )}
    >
      {children == null ? (
        <Figure still={still} afterglow={size !== "bar"} />
      ) : (
        // Absolute, so size-full content fills the measured square.
        <div className="absolute inset-0">{children}</div>
      )}
      {overlay}
    </div>
  );
}

/**
 * The still figure, in the look's trace color. A non-scaling stroke keeps
 * the line 1px in every box, which is what the frames' stroke widths render
 * to. The 36px bar drops the afterglow, as its frame does.
 */
function Figure({
  still,
  afterglow,
}: {
  readonly still: WavePlayerStill;
  readonly afterglow: boolean;
}) {
  const paths = useMemo(() => stillPaths(still), [still]);
  const stroke = STILL_STROKE[still.color];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${STILL_VIEWBOX} ${STILL_VIEWBOX}`}
      className="absolute inset-0 size-full fill-none"
    >
      {afterglow ? (
        <path
          d={paths.afterglow}
          className={stroke.afterglow}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={paths.trace}
        className={stroke.trace}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

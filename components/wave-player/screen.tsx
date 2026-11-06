import type { ReactNode } from "react";
import { cn } from "cn";

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
  overlay,
  children,
}: {
  readonly size: ScreenSize;
  /** Absolutely placed content over the slot, such as a spinner or a failure. */
  readonly overlay?: ReactNode;
  /** What the box shows, such as a frame's dock of the provider's screen. Absent: the dark box alone. */
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
      {children == null ? null : (
        // Absolute, so size-full content fills the measured square.
        <div className="absolute inset-0">{children}</div>
      )}
      {overlay}
    </div>
  );
}

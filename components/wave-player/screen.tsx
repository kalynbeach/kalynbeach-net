import type { ReactNode } from "react";
import { cn } from "cn";

export type ScreenSize = "card" | "mini" | "bar";

const BOX = {
  card: "size-77",
  mini: "aspect-square w-full",
  bar: "size-9",
} as const satisfies Record<ScreenSize, string>;

/** The figure's viewBox side, the Paper card's 316px screen. Every box scales it to fit. */
const FIGURE = 316;

/** Samples around one period, as the Paper figure has. */
const STEPS = 220;

/**
 * The Paper card frame's figure: x = 158 + 118 sin(5t + phase) and
 * y = 158 + 118 sin(4t), so it sits 40 units inside each edge. The afterglow
 * runs 0.12 rad behind the trace.
 */
function lissajous(phase: number): string {
  const center = FIGURE / 2;
  const radius = center - 40;

  const points = Array.from({ length: STEPS + 1 }, (_, step) => {
    const t = (2 * Math.PI * step) / STEPS;
    const x = center + radius * Math.sin(5 * t + phase);
    const y = center + radius * Math.sin(4 * t);

    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return `M${points.join("L")}Z`;
}

const TRACE = lissajous(0.9);

const AFTERGLOW = lissajous(0.78);

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
  /** The site's slot content. Absent: the still figure. */
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
        <Figure afterglow={size !== "bar"} />
      ) : (
        // Absolute, so size-full content fills the mini's measured square too.
        <div className="absolute inset-0">{children}</div>
      )}
      {overlay}
    </div>
  );
}

/**
 * The still figure. A non-scaling stroke keeps the line 1px in the 308,
 * 176, and 36px boxes, which is what the frames' stroke widths render to.
 * The 36px bar drops the afterglow, as its frame does.
 */
function Figure({ afterglow }: { readonly afterglow: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${FIGURE} ${FIGURE}`}
      className="absolute inset-0 size-full fill-none"
    >
      {afterglow ? (
        <path
          d={AFTERGLOW}
          className="stroke-signal-dim"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={TRACE}
        className="stroke-signal"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

"use client";

/*
 * The bar-waveform seek bar and its time row, for the card and the mini.
 *
 * Played bars are the signal and unplayed ones a dither-50 pattern in
 * faint-foreground, the slider track's treatment. Until the track has peaks,
 * a flat dithered groove stands in for the bars.
 *
 * An invisible native range input lies over the bars, so the keyboard, the
 * pointer, and screen readers get a real slider with the position as time
 * text. A playhead mark at the split takes the Slider thumb's ring on hover,
 * focus, and drag, and its glow in dark, so focus shows where the position
 * is rather than around the whole waveform.
 *
 * Keys and screen reader steps seek at once. A pointer drag previews in this
 * bar's own state and seeks on release, so two mounted bars never fight over
 * a preview.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";

import { DitherPattern } from "@/components/ui/dither";

import { seekValueText } from "./format";
import { seekTarget } from "./keys";
import {
  BAR_PITCH,
  BAR_WIDTH,
  SEEK_GEOMETRY,
  barCount,
  layoutBars,
  playedBars,
  resamplePeaks,
  type SeekSize,
} from "./peaks";
import { usePlayhead } from "./playhead";
import { Elapsed, Remaining } from "./readouts";
import { STATUS_VIEW } from "./status-view";
import type { ViewInput } from "./transport";

/** The views' content widths, drawn before the first measurement and on the server. */
const DESIGN_WIDTH = { card: 308, mini: 176 } as const satisfies Record<
  SeekSize,
  number
>;

const HEIGHT = { card: "h-9", mini: "h-6" } as const satisfies Record<
  SeekSize,
  string
>;

export function SeekBar({
  state,
  playhead,
  onCommand,
  size,
  status,
}: ViewInput & {
  readonly size: SeekSize;
  /** Centered in the time row, such as the mini player's status Badge. */
  readonly status?: ReactNode;
}) {
  const current = state.current;
  const duration = current?.track.duration ?? null;
  const view = STATUS_VIEW[state.status.kind];
  const wrapper = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(wrapper, DESIGN_WIDTH[size]);
  const count = barCount(width);
  const peaks = current?.peaks ?? null;

  const pattern = useId();
  const height = SEEK_GEOMETRY[size].height;

  const bars = useMemo(
    () => (peaks ? layoutBars(resamplePeaks(peaks, count), size) : null),
    [peaks, count, size]
  );

  // The drag's value lives in a ref for the handlers and in state for
  // drawing. A drag belongs to the track it started on, so a track that
  // ends and advances mid-drag drops its preview and its seek.
  const id = current?.track.id ?? null;
  const dragging = useRef(false);
  const origin = useRef<string | null>(null);
  const pending = useRef<number | null>(null);

  const [drag, setDrag] = useState<{
    readonly id: string | null;
    readonly value: number;
  } | null>(null);

  const preview = drag && drag.id === id ? drag.value : null;

  const played = usePlayhead(playhead, (position) =>
    playedBars(preview ?? position, duration, count)
  );

  const second = usePlayhead(playhead, (position) =>
    Math.floor(preview ?? position)
  );

  const seek = (to: number) => onCommand({ type: "seek", to });
  const disabled = !current || !view.seekable || duration === null;

  // The gap after the last played bar, where the mark sits.
  const split = played === 0 ? 0 : played * BAR_PITCH - (BAR_PITCH - BAR_WIDTH);

  const drop = () => {
    dragging.current = false;
    origin.current = null;
    pending.current = null;
    setDrag(null);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={wrapper}
        data-dragging={preview === null ? undefined : ""}
        className={cn("group/seek relative w-full", HEIGHT[size])}
      >
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${width} ${height}`}
          className="text-faint-foreground block size-full"
        >
          <defs>
            <DitherPattern id={pattern} density={50} />
          </defs>
          {bars ? (
            bars.map((bar, index) =>
              index < played ? (
                <rect
                  key={bar.x}
                  x={bar.x}
                  y={bar.y}
                  width={BAR_WIDTH}
                  height={bar.height}
                  className="fill-signal"
                />
              ) : (
                <rect
                  key={bar.x}
                  x={bar.x}
                  y={bar.y}
                  width={BAR_WIDTH}
                  height={bar.height}
                  fill={`url(#${pattern})`}
                />
              )
            )
          ) : (
            <>
              <rect
                y={(height - GROOVE) / 2}
                width={width}
                height={GROOVE}
                fill={`url(#${pattern})`}
              />
              <rect
                y={(height - GROOVE) / 2}
                width={split}
                height={GROOVE}
                className="fill-signal"
              />
            </>
          )}
        </svg>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration ?? 0}
          step={1}
          value={second}
          aria-valuetext={seekValueText(second, duration)}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Escape" && dragging.current) {
              drop();

              return;
            }

            const to = seekTarget(event.key, playhead.position(), duration);

            if (to === null) return;

            event.preventDefault();
            seek(to);
          }}
          onPointerDown={() => {
            dragging.current = true;
            origin.current = id;
          }}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);

            if (!dragging.current) {
              seek(value);

              return;
            }

            pending.current = value;
            setDrag({ id: origin.current, value });
          }}
          onPointerUp={() => {
            const value = pending.current;
            const sameTrack = origin.current === id;

            drop();

            if (value !== null && sameTrack) seek(value);
          }}
          onPointerCancel={drop}
          onBlur={drop}
          className="absolute inset-0 size-full opacity-0"
        />
        {disabled ? null : <Mark x={split} />}
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          status ? "h-5" : "h-4"
        )}
      >
        <Elapsed playhead={playhead} known={view.times} preview={preview} />
        {status}
        <Remaining
          playhead={playhead}
          known={view.times}
          preview={preview}
          duration={duration}
        />
      </div>
    </div>
  );
}

/** The no-peaks groove's height, the Slider track's 4px. */
const GROOVE = 4;

/** The playhead mark. Blocks set no inline styles, so an empty SVG's width attribute places it. */
function Mark({ x }: { readonly x: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex"
    >
      <svg width={x} height={1} className="shrink-0" />
      <span className="bg-signal text-signal ring-ring dark:group-has-focus-visible/seek:glow dark:group-data-dragging/seek:glow h-full w-0.5 shrink-0 opacity-0 transition group-hover/seek:opacity-100 group-has-focus-visible/seek:opacity-100 group-has-focus-visible/seek:ring-2 group-data-dragging/seek:opacity-100 group-data-dragging/seek:ring-2" />
    </div>
  );
}

/**
 * The element's width in whole px, from a ResizeObserver. `fallback` is the
 * frame's width, so the server and the first paint draw Paper's bar count
 * and hydration matches.
 */
function useMeasuredWidth(
  ref: RefObject<HTMLElement | null>,
  fallback: number
): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

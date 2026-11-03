"use client";

/*
 * The seek controls: the card's bar waveform with its time row, and the
 * mini player's thin seek line. Both lay an invisible native range input
 * over their drawing, so the keyboard, the pointer, and screen readers get
 * a real slider with the position as time text. One slider model,
 * useSeekSlider, drives both.
 *
 * The card's played bars are Kevelle's progress ramp in the signal: they
 * step through dither 25, 50, and 75 to solid, sparse where playback
 * started and solid at the playhead. Unplayed ones are a dither-50 pattern
 * in faint-foreground, the slider track's treatment. Until the track has
 * peaks, a flat dithered groove stands in for the bars, its played part
 * split into the same steps. A playhead mark at the split takes the Slider
 * thumb's ring on hover, focus, and drag, and its glow in dark, so focus
 * shows where the position is rather than around the whole waveform.
 *
 * The mini player's line is the thin Kevelle Progress, the bar's progress
 * line, under a 24px band that takes the pointer. Keyboard focus rings the
 * band.
 *
 * Keys and screen reader steps seek at once. A pointer drag previews in the
 * control's own state and seeks on release, so two mounted controls never
 * fight over a preview.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";

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
  playedDensity,
  rampBands,
  resamplePeaks,
} from "./peaks";
import { usePlayhead } from "./playhead";
import { ProgressLine } from "./progress-line";
import { Elapsed, Remaining } from "./readouts";
import { STATUS_VIEW } from "./status-view";
import type { ViewInput } from "./transport";

/**
 * The slider both controls share: the current duration, whether times are
 * known, a pointer drag's preview, and the props for the invisible range
 * input that lies over the drawing.
 */
function useSeekSlider({ state, playhead, onCommand }: ViewInput) {
  const current = state.current;
  const duration = current?.track.duration ?? null;
  const view = STATUS_VIEW[state.status.kind];

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

  const second = usePlayhead(playhead, (position) =>
    Math.floor(preview ?? position)
  );

  const seek = (to: number) => onCommand({ type: "seek", to });
  const disabled = !current || !view.seekable || duration === null;

  const drop = () => {
    dragging.current = false;
    origin.current = null;
    pending.current = null;
    setDrag(null);
  };

  const input = {
    type: "range",
    "aria-label": "Seek",
    min: 0,
    max: duration ?? 0,
    step: 1,
    value: second,
    "aria-valuetext": seekValueText(second, duration),
    disabled,
    onKeyDown: (event) => {
      if (event.key === "Escape" && dragging.current) {
        drop();

        return;
      }

      const to = seekTarget(event.key, playhead.position(), duration);

      if (to === null) return;

      event.preventDefault();
      seek(to);
    },
    onPointerDown: () => {
      dragging.current = true;
      origin.current = id;
    },
    onChange: (event) => {
      const value = Number(event.currentTarget.value);

      if (!dragging.current) {
        seek(value);

        return;
      }

      pending.current = value;
      setDrag({ id: origin.current, value });
    },
    onPointerUp: () => {
      const value = pending.current;
      const sameTrack = origin.current === id;

      drop();

      if (value !== null && sameTrack) seek(value);
    },
    onPointerCancel: drop,
    onBlur: drop,
    className: "absolute inset-0 size-full opacity-0",
  } as const satisfies ComponentProps<"input">;

  return { duration, known: view.times, preview, disabled, input };
}

/**
 * The content width drawn before the first measurement and on the server:
 * the 340 card less its padding.
 */
const DESIGN_WIDTH = 308;

/** The card's bar waveform and its time row. */
export function SeekBar(props: ViewInput) {
  const { state, playhead } = props;
  const slider = useSeekSlider(props);
  const wrapper = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(wrapper, DESIGN_WIDTH);
  const count = barCount(width);
  const peaks = state.current?.peaks ?? null;

  const pattern = useId();
  const height = SEEK_GEOMETRY.height;

  const bars = useMemo(
    () => (peaks ? layoutBars(resamplePeaks(peaks, count)) : null),
    [peaks, count]
  );

  const played = usePlayhead(playhead, (position) =>
    playedBars(slider.preview ?? position, slider.duration, count)
  );

  // The gap after the last played bar, where the mark sits.
  const split = played === 0 ? 0 : played * BAR_PITCH - (BAR_PITCH - BAR_WIDTH);

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={wrapper}
        data-dragging={slider.preview === null ? undefined : ""}
        className="group/seek relative h-9 w-full"
      >
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${width} ${height}`}
          className="text-faint-foreground block size-full"
        >
          <defs>
            <DitherPattern id={`${pattern}-faint`} density={50} />
            {/* currentColor inside a pattern is the color where it's defined. */}
            <g className="text-signal">
              <DitherPattern id={`${pattern}-25`} density={25} />
              <DitherPattern id={`${pattern}-50`} density={50} />
              <DitherPattern id={`${pattern}-75`} density={75} />
            </g>
          </defs>
          {bars ? (
            bars.map((bar, index) => {
              const density =
                index < played ? playedDensity(index, played) : "faint";

              return density === 100 ? (
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
                  fill={`url(#${pattern}-${density})`}
                />
              );
            })
          ) : (
            <>
              <rect
                y={(height - GROOVE) / 2}
                width={width}
                height={GROOVE}
                fill={`url(#${pattern}-faint)`}
              />
              {rampBands(split).map((band) =>
                band.density === 100 ? (
                  <rect
                    key={band.x}
                    x={band.x}
                    y={(height - GROOVE) / 2}
                    width={band.width}
                    height={GROOVE}
                    className="fill-signal"
                  />
                ) : (
                  <rect
                    key={band.x}
                    x={band.x}
                    y={(height - GROOVE) / 2}
                    width={band.width}
                    height={GROOVE}
                    fill={`url(#${pattern}-${band.density})`}
                  />
                )
              )}
            </>
          )}
        </svg>
        <input {...slider.input} />
        {slider.disabled ? null : <Mark x={split} />}
      </div>
      <div className="flex h-4 items-center justify-between gap-2">
        <Elapsed
          playhead={playhead}
          known={slider.known}
          preview={slider.preview}
        />
        <Remaining
          playhead={playhead}
          known={slider.known}
          preview={slider.preview}
          duration={slider.duration}
        />
      </div>
    </div>
  );
}

/** The mini player's seek line: the thin Progress under a 24px band that takes the pointer. */
export function SeekLine(props: ViewInput) {
  const slider = useSeekSlider(props);

  return (
    <div className="has-focus-visible:ring-ring relative flex h-6 items-center has-focus-visible:ring-2">
      <ProgressLine
        playhead={props.playhead}
        duration={slider.known ? slider.duration : null}
        preview={slider.preview}
      />
      <input {...slider.input} />
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

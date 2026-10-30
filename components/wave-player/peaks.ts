import type { Seconds } from "@/lib/audio";

declare const brand: unique symbol;

/** Values from 0 to 1, at least one. Only toPeaks() and reducePeaks() make one. */
export type Peaks = readonly number[] & { readonly [brand]: "Peaks" };

/** How many values a decode keeps: more than any seek bar draws, small enough to hold per track. */
export const PEAK_RESOLUTION = 256;

export const BAR_WIDTH = 2;

export const BAR_PITCH = 4;

/** Clamps each value into 0 to 1 and drops non-finite ones. Null when nothing is left. */
export function toPeaks(values: readonly number[]): Peaks | null {
  const clamped = Object.freeze(
    values.flatMap((value) =>
      Number.isFinite(value) ? [Math.min(1, Math.max(0, value))] : []
    )
  );

  if (clamped.length === 0) return null;

  // SAFETY: every value is finite and within [0, 1], and the list is not empty.
  return clamped as Peaks;
}

/**
 * The decoder's overview: `resolution` equal buckets across the file, each
 * the largest absolute sample on any channel, then scaled so the loudest
 * bucket is 1. A quiet master still fills the bar height, and silence draws
 * flat. A file shorter than `resolution` samples keeps one bucket per sample.
 */
export function reducePeaks(
  channels: readonly Float32Array[],
  resolution: number
): Peaks | null {
  const length = channels[0]?.length ?? 0;
  const buckets = Math.min(resolution, length);
  const levels: number[] = [];

  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor((bucket * length) / buckets);
    const end = Math.floor(((bucket + 1) * length) / buckets);
    let peak = 0;

    for (const channel of channels)
      for (let index = start; index < end; index += 1)
        peak = Math.max(peak, Math.abs(channel[index] ?? 0));

    levels.push(peak);
  }

  const loudest = Math.max(0, ...levels);

  return toPeaks(loudest > 0 ? levels.map((level) => level / loudest) : levels);
}

/**
 * Levels for `count` bars. Each bar takes the largest value its share of the
 * peaks covers, so a short transient still shows; with fewer peaks than
 * bars, neighbors repeat a value.
 */
export function resamplePeaks(peaks: Peaks, count: number): readonly number[] {
  const length = peaks.length;

  return Array.from({ length: count }, (_, bar) => {
    const start = Math.floor((bar * length) / count);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / count));

    return Math.max(...peaks.slice(start, end));
  });
}

/** How many bars fit `width` px with the last one ending inside it: 308 -> 77, 176 -> 44, 168 -> 42. */
export function barCount(width: number): number {
  return Math.max(0, Math.floor((width + BAR_PITCH - BAR_WIDTH) / BAR_PITCH));
}

/**
 * How many bars read as played. The split falls between whole bars and a
 * partial bar counts: ceil(position / duration * count), so 1:24 of 4:32
 * lights 14 of 44. None while the duration is unknown.
 */
export function playedBars(
  position: number,
  duration: Seconds | null,
  count: number
): number {
  if (duration === null || duration <= 0) return 0;

  return Math.min(count, Math.max(0, Math.ceil((position / duration) * count)));
}

/**
 * Bar geometry per view, from the Paper frames. Each bar's top rounds up to
 * a whole pixel, so the unplayed bars' 1px dither stays on the pixel grid.
 */
export const SEEK_GEOMETRY = {
  card: { height: 36, min: 5, max: 35 },
  mini: { height: 24, min: 4, max: 20 },
} as const satisfies Record<
  string,
  { readonly height: number; readonly min: number; readonly max: number }
>;

export type SeekSize = keyof typeof SEEK_GEOMETRY;

export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly height: number;
};

/** One square rect per level, vertically centered, left to right on the pitch. */
export function layoutBars(
  levels: readonly number[],
  size: SeekSize
): readonly Bar[] {
  const geometry = SEEK_GEOMETRY[size];

  return levels.map((level, index) => {
    const height = Math.round(
      geometry.min + level * (geometry.max - geometry.min)
    );

    return {
      x: index * BAR_PITCH,
      y: Math.ceil((geometry.height - height) / 2),
      height,
    };
  });
}

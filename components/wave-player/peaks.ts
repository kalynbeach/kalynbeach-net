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
 * The card's bar geometry, from the Paper frame. Each bar's top rounds up
 * to a whole pixel, so the unplayed bars' 1px dither stays on the pixel
 * grid.
 */
export const SEEK_GEOMETRY = { height: 36, min: 5, max: 35 } as const;

export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly height: number;
};

/** One square rect per level, vertically centered, left to right on the pitch. */
export function layoutBars(levels: readonly number[]): readonly Bar[] {
  const { height: box, min, max } = SEEK_GEOMETRY;

  return levels.map((level, index) => {
    const height = Math.round(min + level * (max - min));

    return {
      x: index * BAR_PITCH,
      y: Math.ceil((box - height) / 2),
      height,
    };
  });
}

/**
 * Kevelle's progress ramp, the dither-ramp fill in tools/aura.ts: 30% lit
 * where the played run starts, rising to solid at its leading edge as
 * from + (to - from) · t ^ gamma.
 */
const RAMP = { from: 0.3, to: 1, gamma: 1.2 } as const;

/** The densities a played bar steps through. 100 is solid. */
const DENSITIES = [25, 50, 75, 100] as const;

export type PlayedDensity = (typeof DENSITIES)[number];

/**
 * Where the ramp steps up a density, as shares of the played run: where
 * its lit share crosses halfway between two densities, about 0.16, 0.53,
 * and 0.85.
 */
const RAMP_STEPS = DENSITIES.slice(1).map((density) => {
  const lit = (density - 12.5) / 100;

  return ((lit - RAMP.from) / (RAMP.to - RAMP.from)) ** (1 / RAMP.gamma);
});

/**
 * A played bar's dither density, sparse where the played run starts and
 * solid at its leading edge, as DESIGN.md's progress fill steps through
 * densities rather than fading. `index` counts from 0 among `played` bars,
 * and the last one is always solid.
 */
export function playedDensity(index: number, played: number): PlayedDensity {
  const t = played <= 1 ? 1 : index / (played - 1);

  return DENSITIES[RAMP_STEPS.filter((step) => t >= step).length];
}

export type RampBand = {
  readonly x: number;
  readonly width: number;
  readonly density: PlayedDensity;
};

/**
 * The no-peaks groove's played `width` in whole px, split where the ramp
 * steps. The leading pixel is always solid, as the leading bar is.
 */
export function rampBands(width: number): readonly RampBand[] {
  const lead = Math.max(0, width - 1);

  const edges = [
    0,
    ...RAMP_STEPS.map((t) => Math.min(lead, Math.round(t * width))),
    width,
  ];

  return DENSITIES.flatMap((density, band) => {
    const x = edges[band];
    const end = edges[band + 1];

    return end > x ? [{ x, width: end - x, density }] : [];
  });
}

import type { FrameWriter, TraceIndex } from "./types";

/** 16384 points: 0.34 s of audio at 48 kHz, 256 KiB on the GPU. */
export const MAX_POINTS = 16_384;

/** Enough for 2 channels times 128 sweeps per frame. */
export const MAX_STRIPS = 256;

/** Floats per point: x, y, dt, age. */
export const POINT_FLOATS = 4;

export const DEFAULT_POINT_DURATION = 1 / 48_000;

export type FrameBuffer = {
  readonly writer: FrameWriter;
  /** Clears the frame and sets the point duration back to 1 / 48000. Call before each produce(). */
  reset(): void;
  /** Fills each point's age, in one backward pass per strip. Call after produce() returns. */
  finish(): void;
  readonly points: Float32Array;
  pointCount(): number;
  /** Triples of (first, count, trace). */
  readonly strips: Uint32Array;
  stripCount(): number;
  /** The mean point duration of the frame, or 1 / 48000 for an empty frame. */
  meanDt(): number;
  /** Points dropped this frame past MAX_POINTS, or because their strip came past MAX_STRIPS. */
  overflow(): number;
};

export function createFrameBuffer(): FrameBuffer {
  const points = new Float32Array(MAX_POINTS * POINT_FLOATS);
  const strips = new Uint32Array(MAX_STRIPS * 3);
  let pointCount = 0;
  let stripCount = 0;
  let overflow = 0;
  let dt = DEFAULT_POINT_DURATION;
  let dtSum = 0;
  // The open strip's slot, or -1 before the first strip and while a strip
  // past MAX_STRIPS drops its points. Dropping, never appending to an earlier
  // strip, keeps an overflow from drawing a false line.
  let open = -1;
  let dropping = false;

  const startStrip = (trace: TraceIndex) => {
    if (open >= 0 && strips[open * 3 + 1] === 0) {
      strips[open * 3 + 2] = trace;
      dropping = false;

      return;
    }

    if (stripCount === MAX_STRIPS) {
      dropping = true;

      return;
    }

    open = stripCount;
    stripCount += 1;
    strips[open * 3] = pointCount;
    strips[open * 3 + 1] = 0;
    strips[open * 3 + 2] = trace;
    dropping = false;
  };

  const writer: FrameWriter = {
    pointDuration(seconds) {
      dt = seconds > 0 ? seconds : 0;
    },
    strip: startStrip,
    point(x, y) {
      if (open < 0 && !dropping) startStrip(0);

      if (dropping || pointCount === MAX_POINTS) {
        overflow += 1;

        return;
      }

      const at = pointCount * POINT_FLOATS;
      points[at] = x;
      points[at + 1] = y;
      points[at + 2] = dt;
      points[at + 3] = 0;
      dtSum += dt;
      pointCount += 1;
      strips[open * 3 + 1] += 1;
    },
  };

  return {
    writer,
    points,
    strips,
    reset() {
      pointCount = 0;
      stripCount = 0;
      overflow = 0;
      dt = DEFAULT_POINT_DURATION;
      dtSum = 0;
      open = -1;
      dropping = false;
    },
    finish() {
      for (let strip = 0; strip < stripCount; strip += 1) {
        const first = strips[strip * 3];
        const last = first + strips[strip * 3 + 1] - 1;
        let age = 0;

        for (let index = last; index >= first; index -= 1) {
          points[index * POINT_FLOATS + 3] = age;
          age += points[index * POINT_FLOATS + 2];
        }
      }
    },
    pointCount: () => pointCount,
    stripCount: () => stripCount,
    meanDt: () =>
      pointCount > 0 ? dtSum / pointCount : DEFAULT_POINT_DURATION,
    overflow: () => overflow,
  };
}

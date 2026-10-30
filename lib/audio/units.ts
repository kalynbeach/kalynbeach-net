declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A frequency in hertz. Finite and greater than zero. */
export type Hz = Brand<number, "Hz">;

/** A duration in seconds. Finite and zero or more. */
export type Seconds = Brand<number, "Seconds">;

/** A time on an AudioContext clock (BaseAudioContext.currentTime). */
export type ContextTime = Brand<number, "ContextTime">;

/**
 * An absolute sample frame on the context clock: an integer, where frame 0 is
 * the first frame the context rendered. AudioWorkletGlobalScope.currentFrame
 * counts in the same units, which is what lets the tap stamp each packet.
 */
export type Frame = Brand<number, "Frame">;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Throws RangeError for a non-finite or non-positive value. Clamp first. */
export function toHz(value: number): Hz {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`not a frequency: ${value}`);

  // SAFETY: checked finite and positive above, which is the Hz invariant.
  return value as Hz;
}

/** Throws RangeError for a non-finite or negative value. Clamp first. */
export function toSeconds(value: number): Seconds {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`not a duration: ${value}`);

  // SAFETY: checked finite and non-negative above, which is the Seconds invariant.
  return value as Seconds;
}

/** A context clock reading. Throws RangeError for a non-finite or negative value. */
export function toContextTime(value: number): ContextTime {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`not a context time: ${value}`);

  // SAFETY: checked finite and non-negative above; context clocks start at 0.
  return value as ContextTime;
}

/** Floors to an integer frame. Throws RangeError for a non-finite value. */
export function toFrame(value: number): Frame {
  if (!Number.isFinite(value)) throw new RangeError(`not a frame: ${value}`);

  // SAFETY: Math.floor of a finite number is an integer, the Frame invariant.
  return Math.floor(value) as Frame;
}

/** Clamps a parsed number into [min, max], or returns `fallback` when it is not finite. */
export function clampNumber(
  value: number,
  range: { readonly min: number; readonly max: number },
  fallback: number
): number {
  if (!Number.isFinite(value)) return fallback;

  return Math.min(range.max, Math.max(range.min, value));
}

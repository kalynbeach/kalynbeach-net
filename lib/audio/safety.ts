import { clampNumber } from "./units";

/** Linear gain where the curve leaves the identity. */
export const SAFETY_KNEE = 0.5;

/** Linear gain the curve approaches and never exceeds. */
export const SAFETY_CEILING = 0.89;

/** The shortest gain ramp anywhere in kevelle/audio, in seconds. */
export const MIN_RAMP = 0.02;

/**
 * The soft clip curve over inputs -1 to 1:
 *   y = |x| <= knee ? |x| : knee + (ceiling - knee) tanh((|x| - knee) / (ceiling - knee))
 * with the sign of x. `points` is odd so x = 0 and x = ±knee land on curve
 * samples, which keeps the linear region exact under linear interpolation.
 */
export function safetyCurve(
  points = 4097,
  knee = SAFETY_KNEE,
  ceiling = SAFETY_CEILING
): Float32Array {
  const curve = new Float32Array(points);
  const span = ceiling - knee;

  for (let index = 0; index < points; index++) {
    const x = (index / (points - 1)) * 2 - 1;
    const magnitude = Math.abs(x);

    const y =
      magnitude <= knee
        ? magnitude
        : knee + span * Math.tanh((magnitude - knee) / span);

    curve[index] = Math.sign(x) * y;
  }

  return curve;
}

/** master GainNode(1) -> soft clip (safetyCurve) -> destination. Returns the master input. */
export function createSafetyStage(context: BaseAudioContext): AudioNode {
  const master = context.createGain();
  const clip = context.createWaveShaper();

  // A copy, so the curve sits on a plain ArrayBuffer as the node's type asks.
  clip.curve = new Float32Array(safetyCurve());
  clip.oversample = "none";
  master.connect(clip);
  clip.connect(context.destination);

  return master;
}

/** level 0 to 1 -> linear gain, ceiling × level². Clamps the level; a non-finite level is 0. */
export function levelToGain(level: number, ceiling: number): number {
  const clamped = clampNumber(level, { min: 0, max: 1 }, 0);

  return ceiling * clamped * clamped;
}

// ---------------------------------------------------------------------------
// Internal: how every gain in kevelle/audio moves. Not exported from index.ts.

/** How long a source takes to rise from silence when it starts, and to fall to silence when it stops, in seconds. */
export const SOURCE_FADE = 0.03;

/**
 * Extra wall-clock wait after a fade before its nodes disconnect, in
 * milliseconds: a render quantum plus timer jitter, so the fade lands first.
 */
export const RAMP_SLACK_MS = 20;

/**
 * Freezes `param` at its value at `time` and drops the automation after it.
 * Firefox lacks cancelAndHoldAtTime, so there it cancels and pins the current
 * value, which matches unless a ramp is in flight.
 */
export function holdParam(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === "undefined") {
    param.cancelScheduledValues(time);
    param.setValueAtTime(param.value, time);

    return;
  }

  param.cancelAndHoldAtTime(time);
}

/** Holds `param` at `time`, then moves it linearly to `value` over `seconds`, or at once when `seconds` is 0. */
export function rampParam(
  param: AudioParam,
  value: number,
  time: number,
  seconds: number
): void {
  holdParam(param, time);

  if (seconds > 0) param.linearRampToValueAtTime(value, time + seconds);
  else param.setValueAtTime(value, time);
}

/** rampParam for a gain, which never moves faster than MIN_RAMP. */
export function rampGain(
  param: AudioParam,
  value: number,
  time: number,
  seconds = MIN_RAMP
): void {
  rampParam(param, value, time, Math.max(seconds, MIN_RAMP));
}

/** A strip's fixed stages on one context. See the graph in ./strip. */
export type StripChain = {
  /** Sums the sources after their individual envelopes; always 1. */
  readonly mix: GainNode;
  /** ceiling × level², or 0 with the monitor off. */
  readonly level: GainNode;
};

/** mix -> level (at `gain`) -> master. */
export function createStripChain(
  context: BaseAudioContext,
  master: AudioNode,
  gain: number
): StripChain {
  const mix = context.createGain();
  const level = context.createGain();

  level.gain.value = gain;
  mix.connect(level);
  level.connect(master);

  return { mix, level };
}

/**
 * A gain into `into` that rises from silence to 1 over SOURCE_FADE. Each
 * source plays through its own, so a replaced source falls to silence while
 * the next one rises.
 */
export function createSourceFade(
  context: BaseAudioContext,
  into: AudioNode
): GainNode {
  const fade = context.createGain();
  const now = context.currentTime;

  fade.gain.setValueAtTime(0, now);
  fade.gain.linearRampToValueAtTime(1, now + SOURCE_FADE);
  fade.connect(into);

  return fade;
}

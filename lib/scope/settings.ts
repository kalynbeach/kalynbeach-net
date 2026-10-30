import { toSeconds, type Seconds } from "@/lib/audio";

export type XySettings = {
  /**
   * "lr": X is left, Y is right. "ms": the goniometer, X = (R - L) / 2 and
   * Y = (L + R) / 2, so mono is a vertical line and a left-only signal reads
   * upper left.
   */
  readonly axes: "lr" | "ms";
  /** Mono sources only: Y is the signal delayed by this much, a delay plot. 0.1 ms to 10 ms. */
  readonly delay: Seconds;
};

/** Seconds per division, on 1-2-5 steps. A sweep is SWEEP_DIVISIONS divisions. */
export const TIMEBASES = [
  1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2,
] as const;

export type Timebase = (typeof TIMEBASES)[number];

/** Horizontal divisions of the screen in YT, and of the scale under it in both modes. */
export const SWEEP_DIVISIONS = 10;

export type TriggerSettings = {
  /** The channel the trigger watches: 0 is CH1 (left), 1 is CH2 (right). */
  readonly channel: 0 | 1;
  readonly slope: "rising" | "falling";
  /** -1 to 1 of full scale, after the display gain. */
  readonly level: number;
  /**
   * "auto" free-runs a sweep when no trigger arrives in time, "normal" waits
   * for a trigger, and "single" sweeps once on a trigger and then stops.
   */
  readonly mode: "auto" | "normal" | "single";
};

export type YtSettings = {
  readonly timebase: Timebase;
  readonly channels: "1" | "2" | "both";
  readonly trigger: TriggerSettings;
  /** Share of the sweep drawn before the trigger point, 0 to 0.5. */
  readonly pretrigger: number;
  /** Time after a sweep ends before the trigger re-arms, 0 to 0.5 s. */
  readonly holdoff: Seconds;
};

/**
 * "auto" lifts a quiet signal toward full scale, following its peak with a
 * 2 s release, and never attenuates. "fixed" multiplies by `gain`, 0.25 to 32.
 */
export type ScaleSettings =
  | { readonly kind: "auto" }
  | { readonly kind: "fixed"; readonly gain: number };

/** "xy" draws the left channel against the right, and "yt" sweeps each channel across time. */
export type DisplaySettings = {
  readonly mode: "xy" | "yt";
  readonly xy: XySettings;
  readonly yt: YtSettings;
  readonly scale: ScaleSettings;
};

/** XY on L/R with a 1 ms delay, and a 1 ms auto sweep of both channels ready for YT. */
export const DEFAULT_DISPLAY: DisplaySettings = {
  mode: "xy",
  xy: { axes: "lr", delay: toSeconds(1e-3) },
  yt: {
    timebase: 1e-3,
    channels: "both",
    trigger: { channel: 0, slope: "rising", level: 0, mode: "auto" },
    pretrigger: 0.25,
    holdoff: toSeconds(0),
  },
  scale: { kind: "auto" },
};

/** The range of each numeric display setting, for clamping controls and parsed links. */
export const DISPLAY_LIMITS = {
  delay: { min: 1e-4, max: 1e-2 },
  triggerLevel: { min: -1, max: 1 },
  pretrigger: { min: 0, max: 0.5 },
  holdoff: { min: 0, max: 0.5 },
  gain: { min: 0.25, max: 32 },
} as const;

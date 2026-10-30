import type { PhosphorLook, Rgb, ScreenPresetId, TraceColor } from "./types";

export type ScreenPreset = {
  readonly id: ScreenPresetId;
  readonly label: string;
  /** The color a "screen" trace deposits. P31: the predecessor's trace color. */
  readonly emission: Rgb;
  /** Added in proportion to bloom. P31: the predecessor's bloom shoulder. */
  readonly shoulder: Rgb;
  /**
   * Per-channel decay rate relative to the persistence setting. (1, 1, 1)
   * fades every channel at the predecessor's rate. P7 fades blue over twenty
   * times faster than red and green, which leaves its yellow-green afterglow.
   */
  readonly decay: Rgb;
  /** Tone map: 1 - exp(-lit * k). */
  readonly toneK: Rgb;
  /** Screen tint over the mapped light. */
  readonly tint: Rgb;
  /** The hot core that highlights mix toward. */
  readonly core: Rgb;
  /** Per-channel share of the background lift. */
  readonly floor: Rgb;
};

export const SCREEN_PRESETS = {
  p31: {
    id: "p31",
    label: "P31",
    emission: [0.03, 0.78, 0.2],
    shoulder: [0.004, 0.08, 0.018],
    decay: [1, 1, 1],
    toneK: [1.28, 1.08, 0.9],
    tint: [0.74, 1.0, 0.71],
    core: [0.93, 1.0, 0.9],
    floor: [0.42, 0.64, 0.38],
  },
  // A blue flash over a yellow-green afterglow. Blue fades within a few
  // frames, so it is bright to hold its own on a steady trace, which reads
  // cool blue-white. Red and green fade at about half P31's rate, in the
  // yellow-green ratio, and tone map softer than blue.
  p7: {
    id: "p7",
    label: "P7",
    emission: [0.09, 0.16, 5.0],
    shoulder: [0.006, 0.012, 0.3],
    decay: [0.5, 0.55, 12],
    toneK: [0.9, 0.85, 1.0],
    tint: [0.95, 1.0, 1.0],
    core: [0.95, 0.97, 1.0],
    floor: [0.4, 0.5, 0.6],
  },
  // Blue with a short afterglow: every channel fades three times faster than
  // P31. A steady trace gathers less light, and more emission only clips in
  // the tone map, so P11 stays the dimmest preset on a static figure.
  p11: {
    id: "p11",
    label: "P11",
    emission: [0.1, 0.42, 4.0],
    shoulder: [0.008, 0.036, 0.36],
    decay: [3, 3, 3],
    toneK: [1.3, 1.1, 0.85],
    tint: [0.7, 0.86, 1.0],
    core: [0.88, 0.94, 1.0],
    floor: [0.3, 0.45, 0.7],
  },
  neutral: {
    id: "neutral",
    label: "Neutral",
    // About P31's emission luminance. The softer tone curve clips colored
    // traces less, so they keep more of their hue, and leaves a white trace
    // about as bright as P31's green one.
    emission: [0.58, 0.58, 0.58],
    shoulder: [0.05, 0.05, 0.05],
    decay: [1, 1, 1],
    toneK: [0.75, 0.75, 0.75],
    tint: [1, 1, 1],
    core: [1, 1, 1],
    floor: [0.5, 0.5, 0.5],
  },
} as const satisfies Record<ScreenPresetId, ScreenPreset>;

/** Traces a producer may address: TraceIndex 0 to 3. */
export const MAX_TRACES = 4;

export const LOOK_LIMITS = {
  persistence: { min: 16, max: 128 },
  bloom: { min: 0, max: 1.5 },
  background: { min: 0, max: 0.1 },
  focus: { min: 0.5, max: 4 },
  intensity: { min: 0.25, max: 4 },
  resolution: { min: 0.25, max: 1 },
} as const;

/**
 * The predecessor's Circle preset look, on its own opaque screen at full
 * resolution. HDR is off so the default look holds on HDR displays too.
 */
export const DEFAULT_LOOK: PhosphorLook = {
  screen: "p31",
  beam: "line",
  persistence: 64,
  bloom: 0.75,
  background: 0.02,
  focus: 1.2,
  intensity: 1,
  traces: ["screen", "flame"],
  hdr: false,
  ground: "screen",
  resolution: 1,
};

type Limit = { readonly min: number; readonly max: number };

/** A finite value clamped into its limit; anything else takes the default look's value. */
function within(value: number, limit: Limit, fallback: number) {
  return Number.isFinite(value)
    ? Math.min(limit.max, Math.max(limit.min, value))
    : fallback;
}

/** Clamps every numeric field into LOOK_LIMITS and drops traces past MAX_TRACES. */
export function clampLook(look: PhosphorLook): PhosphorLook {
  const [first, ...rest] = look.traces;

  const traces: [TraceColor, ...TraceColor[]] = [
    first,
    ...rest.slice(0, MAX_TRACES - 1),
  ];

  return {
    ...look,
    persistence: within(
      look.persistence,
      LOOK_LIMITS.persistence,
      DEFAULT_LOOK.persistence
    ),
    bloom: within(look.bloom, LOOK_LIMITS.bloom, DEFAULT_LOOK.bloom),
    background: within(
      look.background,
      LOOK_LIMITS.background,
      DEFAULT_LOOK.background
    ),
    focus: within(look.focus, LOOK_LIMITS.focus, DEFAULT_LOOK.focus),
    intensity: within(
      look.intensity,
      LOOK_LIMITS.intensity,
      DEFAULT_LOOK.intensity
    ),
    resolution: within(
      look.resolution,
      LOOK_LIMITS.resolution,
      DEFAULT_LOOK.resolution
    ),
    traces,
  };
}

import {
  PRESET_ORDER,
  applyPreset,
  nudgeControl,
  type ControlId,
  type WaveformConfig,
} from "./settings";

export type WaveformKey = {
  /** KeyboardEvent.key values. A pair lists the key that lowers first. */
  readonly keys: readonly string[];
  /** Null for a strike, which the button's click carries. */
  readonly apply:
    | ((config: WaveformConfig, key: string, shift: boolean) => WaveformConfig)
    | null;
};

/** Two keys that move one control down and up. */
function pair(down: string, up: string, id: ControlId): WaveformKey {
  return {
    keys: [down, up],
    apply: (config, key, shift) =>
      nudgeControl(config, id, (key === down ? -1 : 1) * (shift ? 5 : 1)),
  };
}

export const WAVEFORM_KEYS: readonly WaveformKey[] = [
  ...PRESET_ORDER.slice(0, 10).map((id, index): WaveformKey => ({
    keys: [String((index + 1) % 10)],
    apply: (config) => applyPreset(config, id),
  })),
  pair("ArrowLeft", "ArrowRight", "tones.x.hz"),
  pair("ArrowDown", "ArrowUp", "tones.ratio"),
  pair(",", ".", "tones.y.phase"),
  pair("-", "=", "motion.drift"),
  pair("[", "]", "look.persistence"),
  pair(";", "'", "motion.symmetry"),
  { keys: [" ", "Enter"], apply: null },
];

/** The aria-keyshortcuts value: every key, in table order. */
export const KEY_SHORTCUTS = WAVEFORM_KEYS.flatMap((entry) =>
  entry.keys.map((key) => (key === " " ? "Space" : key))
).join(" ");

/** The aria-keyshortcuts value when keys only strike. */
export const STRIKE_SHORTCUTS = "Space Enter";

type KeyInput = {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
};

/**
 * The config a key press makes, or null when the key is not a config key or
 * carries Ctrl, Meta, or Alt. The same object back when the control is
 * already at its limit.
 */
export function keyChange(
  config: WaveformConfig,
  event: KeyInput
): WaveformConfig | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const entry = WAVEFORM_KEYS.find((item) => item.keys.includes(event.key));

  return entry?.apply ? entry.apply(config, event.key, event.shiftKey) : null;
}

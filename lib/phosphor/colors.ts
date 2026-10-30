import { MAX_TRACES, type ScreenPreset } from "./presets";
import type { Rgb, TraceColor } from "./types";

export type ResolvedTrace = { readonly emission: Rgb; readonly shoulder: Rgb };

const luminance = (rgb: Rgb) =>
  0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

const decode = (byte: number) => {
  const value = byte / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

let probe: CanvasRenderingContext2D | null = null;

const warned = new Set<string>();

/** The token's color as linear RGB, or null when the property is empty or not a color. */
function readToken(element: Element, token: string): Rgb | null {
  const value = getComputedStyle(element).getPropertyValue(`--${token}`).trim();

  if (!value) return null;
  probe ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  // An invalid color leaves fillStyle unchanged, so start from transparent.
  probe.fillStyle = "transparent";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;

  return a === 0 ? null : [decode(r), decode(g), decode(b)];
}

/**
 * One entry per trace index, MAX_TRACES in all. An index past `traces`
 * draws in the screen's own color. A token that is missing or black falls
 * back to the screen's color and warns once.
 */
export function resolveTraces(
  element: Element,
  traces: readonly TraceColor[],
  preset: ScreenPreset
): readonly ResolvedTrace[] {
  const own: ResolvedTrace = {
    emission: preset.emission,
    shoulder: preset.shoulder,
  };

  const target = luminance(preset.emission);
  const shoulderRatio = luminance(preset.shoulder) / target;

  return Array.from({ length: MAX_TRACES }, (_, index) => {
    const color = traces[index] ?? "screen";

    if (color === "screen") return own;
    const linear = readToken(element, color);
    const measured = linear ? luminance(linear) : 0;

    if (!linear || measured === 0) {
      if (!warned.has(color)) {
        warned.add(color);
        console.warn(
          `[kevelle/phosphor] --${color} is not a color on the canvas; the trace uses the screen's color.`
        );
      }

      return own;
    }

    const scale = target / measured;

    const emission: Rgb = [
      linear[0] * scale,
      linear[1] * scale,
      linear[2] * scale,
    ];

    return {
      emission,
      shoulder: [
        emission[0] * shoulderRatio,
        emission[1] * shoulderRatio,
        emission[2] * shoulderRatio,
      ],
    };
  });
}

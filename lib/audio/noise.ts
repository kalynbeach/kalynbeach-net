import { MIN_RAMP, RAMP_SLACK_MS, rampGain } from "./safety";
import { clampNumber } from "./units";
import { NOISE_COLORS, NOISE_PROCESSOR } from "./worklet-source";

export type NoiseColor = (typeof NOISE_COLORS)[number];

/** Level 0 to 1 maps to a gain of level², before the source's envelope and the strip's level. */
export type NoiseSettings = {
  readonly color: "off" | NoiseColor;
  readonly level: number;
};

// ---------------------------------------------------------------------------
// Internal: the bed's nodes, built by the strip. Not exported from index.ts.

/** A running kevelle-noise processor and its gain on one context. */
export type NoiseBed = {
  readonly node: AudioWorkletNode;
  readonly gain: GainNode;
  color: NoiseColor;
};

/** Starts a silent bed in `color` feeding `into`. The processor must already be loaded on `context`. */
export function createNoiseBed(
  context: BaseAudioContext,
  into: AudioNode,
  color: NoiseColor
): NoiseBed {
  const node = new AudioWorkletNode(context, NOISE_PROCESSOR, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: {
      color: NOISE_COLORS.indexOf(color),
      seed: Math.floor(Math.random() * 2 ** 31),
    },
  });

  const gain = context.createGain();

  gain.gain.value = 0;
  node.connect(gain);
  gain.connect(into);

  return { node, gain, color };
}

/** Switches `bed` to `color` and ramps its gain to level². */
export function tuneNoiseBed(
  bed: NoiseBed,
  color: NoiseColor,
  level: number,
  now: number
): void {
  if (bed.color !== color) {
    bed.node.port.postMessage(NOISE_COLORS.indexOf(color));
    bed.color = color;
  }

  const clamped = clampNumber(level, { min: 0, max: 1 }, 0);

  rampGain(bed.gain.gain, clamped * clamped, now);
}

/** Fades `bed` to silence, then ends its processor and disconnects it, so the tap carries no noise. */
export function releaseNoiseBed(
  bed: NoiseBed,
  now: number,
  setTimer: (callback: () => void, ms: number) => () => void
): void {
  rampGain(bed.gain.gain, 0, now);
  setTimer(() => endNoiseBed(bed), MIN_RAMP * 1000 + RAMP_SLACK_MS);
}

/** Ends the processor and disconnects the bed at once, for a context that is going away. */
export function endNoiseBed(bed: NoiseBed): void {
  bed.node.port.postMessage(-1);
  bed.node.disconnect();
  bed.gain.disconnect();
}

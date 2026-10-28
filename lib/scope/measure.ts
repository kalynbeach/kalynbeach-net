import type { SampleWindow } from "@/lib/audio";

export type ChannelReading = {
  /**
   * Rising zero crossings with 2% hysteresis over the last 250 ms, located
   * to a fraction of a frame by linear interpolation; the median period
   * gives 1 / period. The mean follows a 100 ms constant. A spread greater
   * than 10% of the median period is aperiodic and reads null.
   */
  readonly hz: number | null;
  /** Sample peak with a 1.5 s hold, in dBFS. -Infinity for digital silence. */
  readonly peakDb: number;
  /** RMS with a 300 ms time constant, in dBFS. */
  readonly rmsDb: number;
  /** Peak to peak over the last 250 ms, in full-scale units, 0 to 2. */
  readonly vpp: number;
};

export type Readings = {
  /** The second channel is null for a mono window. */
  readonly channels: readonly [ChannelReading, ChannelReading | null];
  /** X:Y as integers up to 8 when the measured frequencies agree with one within 0.5%, such as "3:2". */
  readonly ratio: string | null;
  /** -1 to 1 over 300 ms: +1 mono, 0 unrelated, -1 out of phase. Null when either channel is silent or mono. */
  readonly correlation: number | null;
};

export interface Meter {
  /** Accumulates frames [from, to) of `window`. */
  push(window: SampleWindow, from: number, to: number): void;
  /** The current readings. Cheap enough to call four times a second. */
  read(): Readings;
  /** The larger channel's held linear peak, 0 to 1 and over, for the auto range. Cheap enough for every frame. */
  peak(): number;
  /** Clears history and adopts a feed's sample rate. */
  reset(sampleRate: number): void;
}

type ChannelHistory = {
  samples: Float32Array;
  count: number;
  cursor: number;
  peaks: Float64Array;
  peakFrames: Float64Array;
  peakHead: number;
  peakTail: number;
  crossings: Float64Array;
  crossingHead: number;
  crossingTail: number;
  periods: Float64Array;
  mean: number;
  previous: number;
  primed: boolean;
  power: number;
};

function channelHistory(sampleRate: number): ChannelHistory {
  const quarter = Math.ceil(sampleRate * 0.25) + 1;
  const hold = Math.ceil(sampleRate * 1.5) + 1;

  return {
    samples: new Float32Array(quarter),
    count: 0,
    cursor: 0,
    peaks: new Float64Array(hold),
    peakFrames: new Float64Array(hold),
    peakHead: 0,
    peakTail: 0,
    crossings: new Float64Array(quarter),
    crossingHead: 0,
    crossingTail: 0,
    periods: new Float64Array(quarter),
    mean: 0,
    previous: 0,
    primed: false,
    power: 0,
  };
}

function clearChannel(channel: ChannelHistory) {
  channel.count = 0;
  channel.cursor = 0;
  channel.peakHead = 0;
  channel.peakTail = 0;
  channel.crossingHead = 0;
  channel.crossingTail = 0;
  channel.mean = 0;
  channel.previous = 0;
  channel.primed = false;
  channel.power = 0;
}

function heldPeak(channel: ChannelHistory): number {
  return channel.peakTail > channel.peakHead
    ? channel.peaks[channel.peakHead % channel.peaks.length]
    : 0;
}

function pushChannel(
  channel: ChannelHistory,
  value: number,
  frame: number,
  sampleRate: number,
  acAlpha: number,
  alpha: number
) {
  channel.samples[channel.cursor] = value;
  channel.cursor = (channel.cursor + 1) % channel.samples.length;
  channel.count = Math.min(channel.count + 1, channel.samples.length);
  channel.power += alpha * (value * value - channel.power);
  const peak = Math.abs(value);
  const size = channel.peaks.length;

  while (
    channel.peakHead < channel.peakTail &&
    channel.peakFrames[channel.peakHead % size] <= frame - sampleRate * 1.5
  )
    channel.peakHead += 1;

  while (
    channel.peakTail > channel.peakHead &&
    channel.peaks[(channel.peakTail - 1) % size] <= peak
  )
    channel.peakTail -= 1;

  channel.peaks[channel.peakTail % size] = peak;
  channel.peakFrames[channel.peakTail % size] = frame;
  channel.peakTail += 1;
  channel.mean += acAlpha * (value - channel.mean);
  const centered = value - channel.mean;
  const hysteresis = heldPeak(channel) * 0.02;

  if (centered < -hysteresis) channel.primed = true;

  const capacity = channel.crossings.length;

  while (
    channel.crossingHead < channel.crossingTail &&
    channel.crossings[channel.crossingHead % capacity] <
      frame - sampleRate * 0.25
  )
    channel.crossingHead += 1;

  if (channel.primed && channel.previous < 0 && centered >= 0) {
    channel.crossings[channel.crossingTail % capacity] =
      frame - 1 - channel.previous / (centered - channel.previous);
    channel.crossingTail += 1;
    channel.primed = false;
  }

  channel.previous = centered;
}

function readChannel(
  channel: ChannelHistory,
  sampleRate: number
): ChannelReading {
  let min = Infinity;
  let max = -Infinity;

  for (let index = 0; index < channel.count; index += 1) {
    const value = channel.samples[index];
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const count = channel.crossingTail - channel.crossingHead - 1;
  let hz: number | null = null;

  if (count >= 2 && max - min > 1e-6) {
    for (let index = 0; index < count; index += 1) {
      const at = channel.crossingHead + index;
      channel.periods[index] =
        channel.crossings[(at + 1) % channel.crossings.length] -
        channel.crossings[at % channel.crossings.length];
    }

    const periods = channel.periods.subarray(0, count).sort();
    const middle = Math.floor(count / 2);

    const median =
      count % 2 ? periods[middle] : (periods[middle - 1] + periods[middle]) / 2;

    if (median > 0 && periods[count - 1] - periods[0] <= median * 0.1)
      hz = sampleRate / median;
  }

  return {
    hz,
    peakDb: 20 * Math.log10(heldPeak(channel)),
    rmsDb: 10 * Math.log10(channel.power),
    vpp: channel.count ? Math.min(2, max - min) : 0,
  };
}

function frequencyRatio(x: number | null, y: number | null): string | null {
  if (x === null || y === null) return null;

  const measured = x / y;
  let error = 0.005;
  let best: readonly [number, number] | null = null;

  for (let p = 1; p <= 8; p += 1) {
    for (let q = 1; q <= 8; q += 1) {
      const difference = Math.abs(p / q - measured) / measured;

      if (
        difference <= error &&
        (difference < error || !best || p + q < best[0] + best[1])
      ) {
        best = [p, q];
        error = difference;
      }
    }
  }

  if (!best) return null;

  let [a, b] = best;

  while (b) [a, b] = [b, a % b];

  return `${best[0] / a}:${best[1] / a}`;
}

export function createMeter(sampleRate: number): Meter {
  let left = channelHistory(sampleRate);
  let right = channelHistory(sampleRate);
  let alpha = 1 - Math.exp(-1 / (sampleRate * 0.3));
  let acAlpha = 1 - Math.exp(-1 / (sampleRate * 0.1));
  let expected: number | null = null;
  let channels: 1 | 2 = 1;
  let sumLeft = 0;
  let sumRight = 0;
  let cross = 0;
  let weight = 0;

  function clear() {
    clearChannel(left);
    clearChannel(right);
    expected = null;
    sumLeft = 0;
    sumRight = 0;
    cross = 0;
    weight = 0;
  }

  return {
    reset(rate) {
      sampleRate = rate;
      left = channelHistory(rate);
      right = channelHistory(rate);
      alpha = 1 - Math.exp(-1 / (rate * 0.3));
      acAlpha = 1 - Math.exp(-1 / (rate * 0.1));
      clear();
    },
    push(window, from, to) {
      const begin = Math.max(from, window.start);
      const end = Math.min(to, window.start + window.length);

      if (begin >= end) return;

      if (
        (expected !== null && begin !== expected) ||
        channels !== window.channels
      )
        clear();

      channels = window.channels;

      for (let frame = begin; frame < end; frame += 1) {
        const index = frame - window.start;
        const x = window.left[index];

        pushChannel(left, x, frame, sampleRate, acAlpha, alpha);

        if (channels === 2) {
          const y = window.right[index];

          pushChannel(right, y, frame, sampleRate, acAlpha, alpha);
          sumLeft += alpha * (x - sumLeft);
          sumRight += alpha * (y - sumRight);
          cross += alpha * (x * y - cross);
          weight += alpha * (1 - weight);
        }
      }

      expected = end;
    },
    read() {
      const x = readChannel(left, sampleRate);
      const y = channels === 2 ? readChannel(right, sampleRate) : null;

      const varianceLeft = weight
        ? left.power - (sumLeft * sumLeft) / weight
        : 0;

      const varianceRight = weight
        ? right.power - (sumRight * sumRight) / weight
        : 0;

      const covariance = weight ? cross - (sumLeft * sumRight) / weight : 0;

      const correlation =
        channels === 2 && varianceLeft > 1e-12 && varianceRight > 1e-12
          ? Math.min(
              1,
              Math.max(-1, covariance / Math.sqrt(varianceLeft * varianceRight))
            )
          : null;

      return {
        channels: [x, y],
        ratio: frequencyRatio(x.hz, y?.hz ?? null),
        correlation,
      };
    },
    peak: () => Math.max(heldPeak(left), channels === 2 ? heldPeak(right) : 0),
  };
}

/** The auto range's gain for a held peak: lifts toward 0.9 of full scale, never below 1, at most 32. */
export function autoGain(peak: number): number {
  return Math.min(32, Math.max(1, peak > 0 ? 0.9 / peak : 32));
}

/**
 * Machine-voice values, keeping their units' case:
 *   hz           "220.0 Hz", "1.20 kHz", "—" for null
 *   db           "-6.1 dBFS", "-∞ dBFS" below -120
 *   vpp          "1.98 FS", peak to peak in full-scale units; the scope
 *                knows no volts, so it claims none
 *   correlation  "+0.98", "-0.40", "—" for null
 */
export function formatReading(
  kind: "hz" | "db" | "vpp" | "correlation",
  value: number | null
): string {
  if (value === null) return "\u2014";

  switch (kind) {
    case "hz":
      return value < 1000
        ? `${value.toFixed(1)} Hz`
        : `${(value / 1000).toFixed(2)} kHz`;
    case "db":
      return value < -120 ? "-∞ dBFS" : `${value.toFixed(1)} dBFS`;
    case "vpp":
      return `${value.toFixed(2)} FS`;
    case "correlation":
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  }
}

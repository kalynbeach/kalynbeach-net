import { RING_FRAMES, type SampleFeed } from "./feed";
import { toFrame, type ContextTime, type Hz, type Seconds } from "./units";

export type Wave = "sine" | "triangle" | "square" | "saw";

export type Tone = {
  readonly wave: Wave;
  readonly hz: Hz;
  /** Fine tuning, -100 to 100 cents. Multiplies hz by 2^(cents / 1200). */
  readonly detuneCents: number;
  /** Start phase in radians, 0 to 2π. Changing it swaps the PeriodicWave, which can click. */
  readonly phase: number;
  /** Linear amplitude, 0 to 1, before the strip's level. */
  readonly amplitude: number;
};

export type TonePair = { readonly left: Tone; readonly right: Tone };

/**
 * "split" sends the left tone to the left channel and the right tone to the
 * right. "summed" sends both tones to both channels at half amplitude each, so
 * the summed peak never exceeds the split peak.
 */
export type Routing = "split" | "summed";

/**
 * Amplitude modulation of both channels by a raised cosine at `hz`: gain runs
 * from 1 - depth to 1 and back once per cycle. Depth is 0 to 1.
 */
export type Pulse = { readonly hz: Hz; readonly depth: number };

/** Everything that defines a tone source's sound. Routing defaults to "split"; no pulse by default. */
export type ToneSource = {
  readonly tones: TonePair;
  readonly routing?: Routing;
  readonly pulse?: Pulse;
};

export const TONE_LIMITS = {
  hz: { min: 1, max: 20_000 },
  detuneCents: { min: -100, max: 100 },
  phase: { min: 0, max: Math.PI * 2 },
  amplitude: { min: 0, max: 1 },
  pulseDepth: { min: 0, max: 1 },
} as const;

/** One automation point. "step" jumps at `at`; "linear" ramps from the previous point to arrive at `at`. */
export type ParamPoint = {
  readonly at: ContextTime;
  readonly value: number;
  readonly curve: "step" | "linear";
};

/**
 * A timeline for a tone source, used by binaural sessions. Each path starts at
 * or after the moment program() is called; the source cancels and holds every
 * value at that moment first, so a program never jumps.
 */
export type ToneProgram = {
  readonly leftHz: readonly ParamPoint[];
  readonly rightHz: readonly ParamPoint[];
  /** The pulse rate. Ignored when the source has no pulse. */
  readonly pulseHz: readonly ParamPoint[];
  /**
   * The source's envelope, 0 to 1, after its noise bed and before the strip's
   * mix, so session fades move only these tones and their noise together.
   * Steps ramp over 20 ms after at; linear arrivals keep at least 20 ms
   * after the preceding arrival or the moment the program applies.
   * A start program sets its opening value before the source fades in.
   */
  readonly envelope: readonly ParamPoint[];
  /** When set, the tones stop at this time, the strip's source ends, and `ended` resolves "programmed". */
  readonly stopAt: ContextTime | null;
};

/**
 * Returned by Strip.play({ kind: "tones" }). Valid until the strip plays
 * another source or stops; AudioStation.restart() rebinds it to the new
 * context, though a program scheduled on the old clock is gone and must be
 * sent again.
 */
export interface ToneHandle {
  /**
   * Moves the pair to `pair` now. Frequency, detune, and amplitude ramp over
   * `glide` (default 30 ms, never under 20 ms for amplitude); wave and phase
   * switch at once. Only values that differ change, so repeat calls are cheap
   * and idempotent.
   */
  set(pair: TonePair, glide?: Seconds): void;
  /** Replaces all automation after now with `program`. */
  program(program: ToneProgram): void;
  /**
   * Resolves once: "programmed" when a program's stopAt ended the source,
   * "replaced" when the strip played another source, stopped, or closed.
   */
  readonly ended: Promise<"programmed" | "replaced">;
}

/**
 * Fraction of the sample rate below which a tone keeps its harmonics. See
 * harmonicLimit(). Chromium band-limits a PeriodicWave itself, dropping
 * partials above roughly 0.63 of Nyquist, so coefficients cut at Nyquist play
 * differently from how the preview sums them (by 0.13 of full scale for a
 * 220 Hz square, measured in the audio lab). Below a quarter of the sample
 * rate the browser keeps every partial, so both evaluate the same sum.
 */
export const BAND_EDGE = 0.25;

/**
 * The most harmonics any wave table carries. Chromium reads a PeriodicWave
 * from a 4096-point table with linear interpolation, and that error grows with
 * the harmonic count: about 1.2e-3 of full scale at 128 harmonics and 3.4e-3
 * at 218 (measured in the audio lab). Partials past 128 only reach notes under
 * 94 Hz at 48 kHz, where they add less than that error.
 */
export const MAX_HARMONICS = 128;

/**
 * How many harmonics a tone at `hz` keeps at `sampleRate`: every n with
 * n × hz < BAND_EDGE × sampleRate, at least 1, at most MAX_HARMONICS.
 * At or above Nyquist it keeps none, so both playback and preview are silent.
 */
export function harmonicLimit(hz: number, sampleRate: number): number {
  if (hz >= sampleRate / 2) return 0;

  // The largest integer strictly below edge / hz.
  const below = Math.ceil((BAND_EDGE * sampleRate) / hz) - 1;

  return Math.min(MAX_HARMONICS, Math.max(1, below));
}

/** What waveTable() returns: PeriodicWave's real (cosine) and imag (sine) arrays, index 0 the unused DC term. */
export type WaveCoefficients = {
  readonly real: Float32Array;
  readonly imag: Float32Array;
};

/** Each wave's sine-series coefficient bn, before normalization. */
const SERIES = {
  sine: (n: number) => (n === 1 ? 1 : 0),
  square: (n: number) => (n % 2 === 1 ? 4 / (Math.PI * n) : 0),
  saw: (n: number) => (n % 2 === 1 ? 2 : -2) / (Math.PI * n),
  triangle: (n: number) =>
    n % 2 === 1 ? (n % 4 === 1 ? 8 : -8) / (Math.PI * n) ** 2 : 0,
} satisfies Record<Wave, (n: number) => number>;

/** waveTable() results kept, oldest evicted first, so a phase slider can't grow the memo without bound. */
const MEMO_SIZE = 256;

const coefficientMemo = new Map<string, WaveCoefficients>();

const peakMemo = new Map<string, number>();

/** Σ b[n] sin(n θ) for n from 1, by Clenshaw's recurrence. */
function sineSum(b: Float64Array, theta: number): number {
  const twoCos = 2 * Math.cos(theta);
  let next = 0;
  let after = 0;

  for (let n = b.length - 1; n >= 1; n -= 1) {
    const current = b[n] + twoCos * next - after;
    after = next;
    next = current;
  }

  return next * Math.sin(theta);
}

/*
 * The peak |x| of a truncated sine series. Every wave here is odd, so the
 * search covers [0, π]: a grid of 16 points per harmonic lands in the tallest
 * lobe, whose neighbors differ by far more than the grid can miss, and a
 * golden-section search within one grid step of the best point pins the peak
 * to rounding error. Phase only shifts the waveform, so the peak depends on
 * the wave and its harmonic count alone.
 */
function seriesPeak(wave: Wave, b: Float64Array): number {
  const key = `${wave} ${b.length - 1}`;
  const known = peakMemo.get(key);

  if (known !== undefined) return known;

  const height = (theta: number) => Math.abs(sineSum(b, theta));
  const points = Math.max(1024, 16 * (b.length - 1));
  const step = Math.PI / points;
  let best = 1;
  let bestHeight = height(step);

  for (let index = 2; index < points; index += 1) {
    const candidate = height(index * step);

    if (candidate > bestHeight) {
      best = index;
      bestHeight = candidate;
    }
  }

  const ratio = (Math.sqrt(5) - 1) / 2;
  let low = (best - 1) * step;
  let high = (best + 1) * step;
  let left = high - ratio * (high - low);
  let right = low + ratio * (high - low);
  let leftHeight = height(left);
  let rightHeight = height(right);

  for (let round = 0; round < 64; round += 1) {
    if (leftHeight > rightHeight) {
      high = right;
      right = left;
      rightHeight = leftHeight;
      left = high - ratio * (high - low);
      leftHeight = height(left);
    } else {
      low = left;
      left = right;
      leftHeight = rightHeight;
      right = low + ratio * (high - low);
      rightHeight = height(right);
    }
  }

  const peak = Math.max(bestHeight, leftHeight, rightHeight);
  peakMemo.set(key, peak);

  return peak;
}

/**
 * Fourier coefficients for one cycle of `wave` shifted by `phase`, truncated
 * to `harmonics` and scaled so that truncated waveform's peak is exactly 1.
 * The native graph passes them to createPeriodicWave with
 * disableNormalization: true, and the preview evaluates the same arrays.
 * Memoized per (wave, phase, harmonics); callers must not write to them.
 *
 *   sine:     b1 = 1
 *   square:   bn = 4 / (π n) for odd n
 *   saw:      bn = 2 (-1)^(n+1) / (π n)
 *   triangle: bn = 8 (-1)^((n-1)/2) / (π n)^2 for odd n
 *   phase φ rotates harmonic n by n φ: real[n] = bn sin(n φ), imag[n] = bn cos(n φ)
 */
export function waveTable(
  wave: Wave,
  phase: number,
  harmonics: number
): WaveCoefficients {
  const key = `${wave} ${phase} ${harmonics}`;
  const known = coefficientMemo.get(key);

  if (known !== undefined) return known;

  const b = new Float64Array(harmonics + 1);

  for (let n = 1; n <= harmonics; n += 1) b[n] = SERIES[wave](n);

  const peak = seriesPeak(wave, b);
  const real = new Float32Array(Math.max(2, harmonics + 1));
  const imag = new Float32Array(Math.max(2, harmonics + 1));

  for (let n = 1; n <= harmonics; n += 1) {
    real[n] = (b[n] / peak) * Math.sin(n * phase);
    imag[n] = (b[n] / peak) * Math.cos(n * phase);
  }

  const coefficients = { real, imag };

  if (coefficientMemo.size >= MEMO_SIZE)
    coefficientMemo.delete(coefficientMemo.keys().next().value ?? key);

  coefficientMemo.set(key, coefficients);

  return coefficients;
}

/** In-place inverse FFT without the 1/n scale: x[j] = Σ X[k] e^(2πi jk / n). `re.length` is a power of two. */
function inverseFft(re: Float64Array, im: Float64Array): void {
  const size = re.length;

  for (let index = 1, mirror = 0; index < size; index += 1) {
    let bit = size >> 1;

    for (; mirror & bit; bit >>= 1) mirror ^= bit;

    mirror ^= bit;

    if (index < mirror) {
      const real = re[index];
      const imag = im[index];
      re[index] = re[mirror];
      im[index] = im[mirror];
      re[mirror] = real;
      im[mirror] = imag;
    }
  }

  for (let half = 1; half < size; half *= 2) {
    for (let k = 0; k < half; k += 1) {
      const cos = Math.cos((Math.PI * k) / half);
      const sin = Math.sin((Math.PI * k) / half);

      for (let top = k; top < size; top += 2 * half) {
        const bottom = top + half;
        const real = re[bottom] * cos - im[bottom] * sin;
        const imag = re[bottom] * sin + im[bottom] * cos;
        re[bottom] = re[top] - real;
        im[bottom] = im[top] - imag;
        re[top] += real;
        im[top] += imag;
      }
    }
  }
}

/*
 * One cycle of a waveTable() result, sampled at a power of two of at least 32
 * points per harmonic. Third-order interpolation at that density stays within
 * about 3e-6 of the exact sum even for a 256-harmonic saw (more than MAX_HARMONICS), and the cost per
 * sample doesn't grow with the harmonic count. Keyed by the coefficients
 * object, so a table lives as long as its coefficients stay memoized.
 */
const cycleMemo = new WeakMap<WaveCoefficients, Float64Array>();

function cycleTable(coefficients: WaveCoefficients): Float64Array {
  const known = cycleMemo.get(coefficients);

  if (known !== undefined) return known;

  const harmonics = coefficients.real.length - 1;
  let size = 1024;

  while (size < 32 * harmonics) size *= 2;

  const re = new Float64Array(size);
  const im = new Float64Array(size);

  // Re Σ (a - i b) e^(iθn) = Σ a cos(nθ) + b sin(nθ), the PeriodicWave sum.
  for (let n = 1; n <= harmonics; n += 1) {
    re[n] = coefficients.real[n];
    im[n] = -coefficients.imag[n];
  }

  inverseFft(re, im);
  cycleMemo.set(coefficients, re);

  return re;
}

/** 4-point, third-order Lagrange interpolation of a one-cycle table at a phase in cycles. */
function sampleCycle(table: Float64Array, cycles: number): number {
  const mask = table.length - 1;
  const position = (cycles - Math.floor(cycles)) * table.length;
  const index = Math.floor(position);
  const t = position - index;
  const before = table[(index - 1) & mask];
  const at = table[index & mask];
  const next = table[(index + 1) & mask];
  const after = table[(index + 2) & mask];
  const c1 = next - before / 3 - at / 2 - after / 6;
  const c2 = (before + next) / 2 - at;
  const c3 = (after - before) / 6 + (at - next) / 2;

  return ((c3 * t + c2) * t + c1) * t + at;
}

/** An oscillator's phase: `cycles` at `frame`, advancing hz / sampleRate per frame. */
type Phasor = {
  readonly frame: number;
  readonly cycles: number;
  readonly hz: number;
};

function effectiveHz(tone: Tone): number {
  return tone.hz * 2 ** (tone.detuneCents / 1200);
}

function sameTone(left: Tone, right: Tone): boolean {
  return (
    left.wave === right.wave &&
    left.hz === right.hz &&
    left.detuneCents === right.detuneCents &&
    left.phase === right.phase &&
    left.amplitude === right.amplitude
  );
}

/**
 * A feed that synthesizes `get()` on the main thread at `sampleRate`, clocked
 * by performance.now(). It needs no AudioContext, so it runs before the page
 * has a user gesture. Routing and pulse follow the source, so it draws what a
 * native render of the same source plays, frame for frame, when both start at
 * frame 0. A frequency change keeps each channel's phase continuous, as an
 * OscillatorNode does: the new frequency takes over at the first frame of the
 * read that sees it. Any frame the feed holds can be read again, and reads
 * agree with each other as long as the source doesn't change in between.
 */
export function createPreviewFeed(
  get: () => ToneSource,
  sampleRate = 48_000
): SampleFeed {
  let heard = 0;
  let left: Phasor | null = null;
  let right: Phasor | null = null;
  let pulse: Phasor | null = null;

  function cyclesAt(phasor: Phasor, frame: number): number {
    return phasor.cycles + ((frame - phasor.frame) * phasor.hz) / sampleRate;
  }

  /** `phasor` at `hz` from `frame` on, with no phase jump. A new oscillator counts from frame 0, where the native graph starts it. */
  function retune(phasor: Phasor | null, hz: number, frame: number): Phasor {
    if (phasor === null) return { frame: 0, cycles: 0, hz };

    if (phasor.hz === hz) return phasor;

    const cycles = cyclesAt(phasor, frame);

    return { frame, cycles: cycles - Math.floor(cycles), hz };
  }

  function render(
    tone: Tone,
    phasor: Phasor,
    start: number,
    length: number,
    out: Float32Array
  ) {
    const table = cycleTable(
      waveTable(tone.wave, tone.phase, harmonicLimit(phasor.hz, sampleRate))
    );

    for (let offset = 0; offset < length; offset += 1) {
      out[offset] =
        tone.amplitude * sampleCycle(table, cyclesAt(phasor, start + offset));
    }
  }

  function oldest(): number {
    return Math.max(0, heard - RING_FRAMES);
  }

  return {
    sampleRate,

    heardAt(now) {
      heard = Math.max(heard, Math.floor((now / 1000) * sampleRate));

      return toFrame(heard);
    },

    oldest: () => toFrame(oldest()),

    read(from, to, into) {
      const source = get();
      const start = Math.max(from, oldest());

      const length = Math.max(
        0,
        Math.min(to, heard, start + into.left.length) - start
      );

      left = retune(left, effectiveHz(source.tones.left), start);
      right = retune(right, effectiveHz(source.tones.right), start);
      render(source.tones.left, left, start, length, into.left);
      render(source.tones.right, right, start, length, into.right);

      if (source.routing === "summed") {
        for (let offset = 0; offset < length; offset += 1) {
          const mid = 0.5 * (into.left[offset] + into.right[offset]);
          into.left[offset] = mid;
          into.right[offset] = mid;
        }
      }

      if (source.pulse !== undefined) {
        const half = source.pulse.depth / 2;
        pulse = retune(pulse, source.pulse.hz, start);

        for (let offset = 0; offset < length; offset += 1) {
          const gain =
            1 -
            half -
            half * Math.cos(2 * Math.PI * cyclesAt(pulse, start + offset));

          into.left[offset] *= gain;
          into.right[offset] *= gain;
        }
      }

      into.start = toFrame(start);
      into.length = length;
      into.channels = 2;

      return into;
    },

    layout() {
      const { tones, routing } = get();

      return routing === "summed" || sameTone(tones.left, tones.right)
        ? "mono"
        : "stereo";
    },

    stats: () => ({ packets: 0, droppedFrames: 0, runs: 0 }),
  };
}

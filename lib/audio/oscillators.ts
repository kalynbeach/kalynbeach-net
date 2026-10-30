import { createNoiseBed, type NoiseSettings, tuneNoiseBed } from "./noise";
import {
  createSafetyStage,
  createSourceFade,
  createStripChain,
  holdParam,
  levelToGain,
  MIN_RAMP,
  rampGain,
  rampParam,
} from "./safety";
import { harmonicLimit, TONE_LIMITS, waveTable } from "./tones";
import type {
  ParamPoint,
  Pulse,
  Tone,
  TonePair,
  ToneProgram,
  ToneSource,
} from "./tones";
import { clampNumber } from "./units";
import { loadWorklets } from "./worklet";

/** An offline render of a tone source through the same chain a strip plays it on. */
export type ToneRender = {
  readonly source: ToneSource;
  /**
   * Times on the offline clock, which starts at 0. Applied before the
   * oscillators start, as Strip.play applies a program. Null plays the
   * source as set.
   */
  readonly program: ToneProgram | null;
  /** A noise bed under the tones, as Strip.setNoise sets it. Absent or "off" renders none. */
  readonly noise?: NoiseSettings;
  readonly seconds: number;
  readonly sampleRate: number;
  /** The strip ceiling and level, as Strip.setLevel maps them. */
  readonly ceiling: number;
  readonly level: number;
};

/**
 * Renders `render` on an OfflineAudioContext through the strip's own chain:
 * source fade from silence, envelope, level (ceiling × level²), and the
 * station's safety stage. Tests and blocks use it to measure what a strip
 * plays without a gesture or a device. With a noise bed it loads the worklet
 * processors first, and rejects when the page's policy blocks them.
 */
export async function renderTones(render: ToneRender): Promise<AudioBuffer> {
  const frames = Math.max(1, Math.round(render.seconds * render.sampleRate));
  const context = new OfflineAudioContext(2, frames, render.sampleRate);
  const noise = render.noise ?? { color: "off", level: 0 };

  if (noise.color !== "off") {
    const loaded = await loadWorklets(context);

    if (!loaded.ok) throw new Error(`worklet-blocked: ${loaded.error.message}`);
  }

  const chain = createStripChain(
    context,
    createSafetyStage(context),
    levelToGain(render.level, render.ceiling)
  );

  const envelope = context.createGain();

  envelope.connect(chain.mix);

  const fade = createSourceFade(context, envelope);

  const graph = createToneGraph(context, {
    source: render.source,
    envelope: envelope.gain,
    fade: fade.gain,
    when: 0,
    program: render.program,
    onEnded: () => {},
    // renderTones() never calls set(), so no glide waits on a timer.
    setTimer: () => () => {},
  });

  graph.output.connect(fade);

  if (noise.color !== "off") {
    const bed = createNoiseBed(context, fade, noise.color);

    tuneNoiseBed(bed, noise.color, noise.level, 0);
  }

  return context.startRendering();
}

// ---------------------------------------------------------------------------
// Internal: the graph a strip builds per tone source. Not exported from index.ts.

/** A tone source's nodes on one context, from the oscillators to the pulse stage. */
export type ToneGraph = {
  /** Two channels: the left tone in channel 0 and the right in channel 1, or both summed into each. */
  readonly output: AudioNode;
  /** Moves to `pair` from now. See ToneHandle.set. */
  set(pair: TonePair, glide: number): void;
  /** Replaces the automation after now, the source's envelope included. */
  program(program: ToneProgram): void;
  /** Stops the oscillators now and disconnects every node. onEnded does not fire. */
  dispose(): void;
};

export type ToneGraphOptions = {
  readonly source: ToneSource;
  /** The source's envelope gain, which a program's envelope path drives. */
  readonly envelope: AudioParam;
  /** The source fade also silences its bed on the audio clock. */
  readonly fade: AudioParam;
  /** The context time the oscillators start at. */
  readonly when: number;
  /**
   * Applied before the oscillators start, so the first rendered frame
   * already follows it: the envelope begins at the program's first envelope
   * value, or at 1 when the path is empty.
   */
  readonly program: ToneProgram | null;
  /** A program's stopAt ended the oscillators. */
  readonly onEnded: () => void;
  /** Settles a downward glide's harmonic count once the glide is over. */
  readonly setTimer: (callback: () => void, ms: number) => () => void;
};

type Voice = {
  readonly oscillator: OscillatorNode;
  readonly amplitude: GainNode;
  tone: Tone;
  harmonics: number;
};

type PulseStage = {
  readonly gain: GainNode;
  readonly lfo: OscillatorNode;
  readonly swing: GainNode;
};

/** stop() can be moved but not cancelled, so a program without stopAt moves an earlier one this far out. */
const NEVER = 1e9;

const ENVELOPE_RANGE = { min: 0, max: 1 };

/** Builds the graph for `options.source`, applies its program, and starts it at `options.when`. */
export function createToneGraph(
  context: BaseAudioContext,
  options: ToneGraphOptions
): ToneGraph {
  const { source, envelope } = options;
  const left = createVoice(context, source.tones.left);
  const right = createVoice(context, source.tones.right);
  const merger = context.createChannelMerger(2);

  const nodes: AudioNode[] = [
    left.oscillator,
    left.amplitude,
    right.oscillator,
    right.amplitude,
    merger,
  ];

  if ((source.routing ?? "split") === "split") {
    left.amplitude.connect(merger, 0, 0);
    right.amplitude.connect(merger, 0, 1);
  } else {
    // Half each, so the summed peak never exceeds the split peak.
    const sum = context.createGain();

    sum.gain.value = 0.5;
    left.amplitude.connect(sum);
    right.amplitude.connect(sum);
    sum.connect(merger, 0, 0);
    sum.connect(merger, 0, 1);
    nodes.push(sum);
  }

  const pulse = source.pulse
    ? createPulse(context, merger, source.pulse)
    : null;
  const oscillators = [left.oscillator, right.oscillator];

  if (pulse) {
    nodes.push(pulse.gain, pulse.lfo, pulse.swing);
    oscillators.push(pulse.lfo);
  }

  let stopScheduled = false;
  let programmed = false;

  /** Every param the program drives; `opening` also sets the envelope's starting value. */
  function applyProgram(program: ToneProgram, now: number, opening: boolean) {
    programmed = true;
    schedule(left.oscillator.frequency, program.leftHz, now);
    schedule(right.oscillator.frequency, program.rightHz, now);

    if (pulse) schedule(pulse.lfo.frequency, program.pulseHz, now);

    holdParam(envelope, now);

    if (opening) {
      const first = program.envelope.length > 0 ? program.envelope[0].value : 1;

      envelope.setValueAtTime(
        clampNumber(first, ENVELOPE_RANGE, ENVELOPE_RANGE.min),
        now
      );
    }

    layEnvelope(envelope, program.envelope, now, opening);
    fitHarmonics(context, left, program.leftHz);
    fitHarmonics(context, right, program.rightHz);
  }

  /** stop() throws before start(), so stops follow the oscillators' start. */
  function applyStop(stopAt: number | null) {
    if (stopAt === null && !stopScheduled) return;

    const now = context.currentTime;

    if (stopAt === null || stopScheduled) rampGain(options.fade, 1, now);

    if (stopAt !== null) {
      const start = Math.max(now, stopAt - MIN_RAMP);

      holdParam(options.fade, start);
      options.fade.linearRampToValueAtTime(0, Math.max(now, stopAt));
    }

    for (const oscillator of oscillators) oscillator.stop(stopAt ?? NEVER);

    stopScheduled = stopAt !== null;
  }

  if (options.program) applyProgram(options.program, options.when, true);

  for (const oscillator of oscillators) oscillator.start(options.when);

  if (options.program) applyStop(options.program.stopAt);

  const ended = () => options.onEnded();

  left.oscillator.addEventListener("ended", ended);

  return {
    output: pulse ? pulse.gain : merger,
    set(pair, glide) {
      const now = context.currentTime;

      setVoice(
        context,
        left,
        pair.left,
        now,
        glide,
        options.setTimer,
        programmed
      );
      setVoice(
        context,
        right,
        pair.right,
        now,
        glide,
        options.setTimer,
        programmed
      );

      if (programmed && pulse && source.pulse)
        rampParam(pulse.lfo.frequency, source.pulse.hz, now, glide);

      programmed = false;
    },
    program(program) {
      applyProgram(program, context.currentTime, false);
      applyStop(program.stopAt);
    },
    dispose() {
      left.oscillator.removeEventListener("ended", ended);

      for (const oscillator of oscillators) oscillator.stop();

      for (const node of nodes) node.disconnect();
    },
  };
}

function createVoice(context: BaseAudioContext, tone: Tone): Voice {
  const voice: Voice = {
    oscillator: context.createOscillator(),
    amplitude: context.createGain(),
    tone,
    harmonics: harmonicLimit(effectiveHz(tone), context.sampleRate),
  };

  applyWave(context, voice, voice.harmonics);
  voice.oscillator.frequency.value = tone.hz;
  voice.oscillator.detune.value = tone.detuneCents;
  voice.amplitude.gain.value = amplitudeOf(tone);
  voice.oscillator.connect(voice.amplitude);

  return voice;
}

/**
 * The pulse stage: a gain whose own value is 1 - depth/2 and whose param also
 * takes an LFO of -cos(2π f t) scaled by depth/2, so the gain runs
 * 1 - depth/2 - (depth/2) cos(2π f t), from 1 - depth at t = 0 up to 1.
 */
function createPulse(
  context: BaseAudioContext,
  input: AudioNode,
  pulse: Pulse
): PulseStage {
  const depth = clampNumber(pulse.depth, TONE_LIMITS.pulseDepth, 0);

  const stage = {
    gain: context.createGain(),
    lfo: context.createOscillator(),
    swing: context.createGain(),
  };

  stage.lfo.setPeriodicWave(
    context.createPeriodicWave(new Float32Array([0, -1]), new Float32Array(2), {
      disableNormalization: true,
    })
  );

  stage.lfo.frequency.value = pulse.hz;
  stage.swing.gain.value = depth / 2;
  stage.gain.gain.value = 1 - depth / 2;
  stage.lfo.connect(stage.swing);
  stage.swing.connect(stage.gain.gain);
  input.connect(stage.gain);

  return stage;
}

function setVoice(
  context: BaseAudioContext,
  voice: Voice,
  tone: Tone,
  now: number,
  glide: number,
  setTimer: ToneGraphOptions["setTimer"],
  programmed: boolean
): void {
  const before = voice.tone;
  const amplitude = amplitudeOf(tone);

  if (programmed || tone.hz !== before.hz)
    rampParam(voice.oscillator.frequency, tone.hz, now, glide);

  if (tone.detuneCents !== before.detuneCents)
    rampParam(voice.oscillator.detune, tone.detuneCents, now, glide);

  if (amplitude !== amplitudeOf(before))
    rampGain(voice.amplitude.gain, amplitude, now, glide);

  voice.tone = tone;

  const settled = harmonicLimit(effectiveHz(tone), context.sampleRate);

  const harmonics =
    glide > 0
      ? harmonicLimit(
          Math.max(effectiveHz(before), effectiveHz(tone)),
          context.sampleRate
        )
      : settled;

  const waveChanged = tone.wave !== before.wave || tone.phase !== before.phase;

  if (waveChanged || harmonics !== voice.harmonics)
    applyWave(context, voice, harmonics);

  if (harmonics === settled) return;

  setTimer(() => {
    if (voice.tone === tone) applyWave(context, voice, settled);
  }, glide * 1000);
}

/** A program can sweep anywhere on its path, so the table keeps the count for the path's highest frequency. */
function fitHarmonics(
  context: BaseAudioContext,
  voice: Voice,
  path: readonly ParamPoint[]
): void {
  let highest = voice.oscillator.frequency.value;

  for (const point of path) highest = Math.max(highest, point.value);

  const ratio = 2 ** (voice.tone.detuneCents / 1200);
  const harmonics = harmonicLimit(highest * ratio, context.sampleRate);

  if (harmonics !== voice.harmonics) applyWave(context, voice, harmonics);
}

function applyWave(
  context: BaseAudioContext,
  voice: Voice,
  harmonics: number
): void {
  const table = waveTable(voice.tone.wave, voice.tone.phase, harmonics);

  voice.oscillator.setPeriodicWave(
    context.createPeriodicWave(table.real, table.imag, {
      disableNormalization: true,
    })
  );

  voice.harmonics = harmonics;
}

/** Cancels and holds `param` at `now`, then lays `points` after it. */
function schedule(
  param: AudioParam,
  points: readonly ParamPoint[],
  now: number
): void {
  holdParam(param, now);
  lay(param, points);
}

/** Envelope automation keeps the gain floor while frequency paths retain exact times. */
function layEnvelope(
  param: AudioParam,
  points: readonly ParamPoint[],
  now: number,
  opening: boolean
): void {
  let previous = now;

  for (let index = opening ? 1 : 0; index < points.length; index++) {
    const point = points[index];
    const value = clampNumber(point.value, ENVELOPE_RANGE, 0);

    if (point.curve === "step") {
      const start = Math.max(previous, point.at);

      holdParam(param, start);
      previous = start + MIN_RAMP;
    } else previous = Math.max(point.at, previous + MIN_RAMP);

    param.linearRampToValueAtTime(value, previous);
  }
}

/** Lays `points` on `param`: "step" jumps at `at`, "linear" ramps to arrive at `at`. */
function lay(
  param: AudioParam,
  points: readonly ParamPoint[],
  range?: { readonly min: number; readonly max: number }
): void {
  for (const point of points) {
    const value = range
      ? clampNumber(point.value, range, range.min)
      : point.value;

    if (point.curve === "step") param.setValueAtTime(value, point.at);
    else param.linearRampToValueAtTime(value, point.at);
  }
}

function effectiveHz(tone: Tone): number {
  return tone.hz * 2 ** (tone.detuneCents / 1200);
}

/** Amplitude is clamped here, not trusted, because the ceiling assumes it never exceeds 1. */
function amplitudeOf(tone: Tone): number {
  return clampNumber(tone.amplitude, TONE_LIMITS.amplitude, 0);
}

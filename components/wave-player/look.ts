import type { Wave } from "@/lib/audio";
import type { TraceColor } from "@/lib/phosphor";

/** JSON as a store hands it back. kevelle/waveform's StoredValue has the same fields, so parseWaveformConfig takes a look's config as is. */
export type LookValue =
  | null
  | boolean
  | number
  | string
  | readonly LookValue[]
  | LookRecord;

export type LookRecord = { readonly [key: string]: LookValue | undefined };

/** One axis of a still: wave(2π · cycles · t + phase) for t over one period. */
export type StillAxis = {
  readonly wave: Wave;
  /** Whole cycles over the period, 1 to 16. */
  readonly cycles: number;
  /** Radians. */
  readonly phase: number;
};

/**
 * The idle figure: one closed figure in one trace color. kevelle/waveform's
 * StillFigure has the same fields, so a site passes stillFigure(config)
 * here, and that assignment stops compiling if the two drift.
 */
export type WavePlayerStill = {
  readonly x: StillAxis;
  readonly y: StillAxis;
  readonly color: TraceColor;
};

/** A waveform look as a track carries it. Both halves describe one look. */
export type WavePlayerLook = {
  /**
   * kevelle/waveform's WaveformConfig as stored JSON. The player draws the
   * playing audio whatever its source or screen figure says, and its tones
   * while the audio is silent.
   */
  readonly config: LookRecord;
  /** The same look's still, from kevelle/waveform's stillFigure(config). */
  readonly still: WavePlayerStill;
};

/** The most cycles either axis draws. kevelle/waveform's STILL_MAX_CYCLES; tools/wave-player/look.test.ts pins the two together. */
const MAX_CYCLES = 16;

/** kevelle/waveform's ratio ids, the figures a form can draw of its own. tools/wave-player/look.test.ts folds each one and pins the two lists together. */
const RATIO_IDS = [
  "1:1",
  "2:1",
  "3:2",
  "4:3",
  "5:4",
  "1:2",
  "3:1",
  "5:3",
  "8:5",
  "1:phi",
  "phi:1",
  "1:phi2",
  "2:phi",
] as const;

/**
 * The block's default player look, for a track without one: the Paper
 * card's 5:4 figure, with X 0.9 rad ahead and in tune and Y a half turn
 * round, since the Paper figure's y runs down the page and the screen's
 * runs up. It draws the playing audio, as every player look does.
 * kevelle/waveform's defaults hold otherwise, the P31 screen among them. It
 * is never a site's live look. tools/wave-player/look.test.ts
 * fails when `still` stops matching stillFigure(parseWaveformConfig(config)),
 * or when the waveform's parser drops a key of `config`.
 */
export const DEFAULT_LOOK: WavePlayerLook = {
  config: {
    source: "audio",
    tones: {
      ratio: "5:4",
      x: { phase: 0.9, detuneCents: 0 },
      y: { phase: Math.PI },
    },
  },
  still: {
    x: { wave: "sine", cycles: 5, phase: 0.9 },
    y: { wave: "sine", cycles: 4, phase: Math.PI },
    color: "screen",
  },
};

/** The ideal shape of each kevelle/audio wave, from -1 to 1, with that library's phase. */
const WAVE = {
  sine: (theta: number) => Math.sin(theta),
  triangle: (theta: number) => (2 / Math.PI) * Math.asin(Math.sin(theta)),
  square: (theta: number) => (Math.sin(theta) >= 0 ? 1 : -1),
  saw: (theta: number) => {
    const turns = theta / (2 * Math.PI);

    return 2 * (turns - Math.floor(turns + 0.5));
  },
} as const satisfies Record<Wave, (theta: number) => number>;

/**
 * Stroke classes inside the screen box, which is `dark` in both themes.
 * There the chart tokens are phosphor, astral, flame, magenta, and chrome,
 * in that order, and the P31 screen's own green is the signal.
 * tools/wave-player/look.test.ts reads that order from kevelle.css.
 */
export const STILL_STROKE = {
  screen: { trace: "stroke-signal", afterglow: "stroke-signal-dim" },
  phosphor: { trace: "stroke-chart-1", afterglow: "stroke-chart-1/50" },
  astral: { trace: "stroke-chart-2", afterglow: "stroke-chart-2/50" },
  flame: { trace: "stroke-chart-3", afterglow: "stroke-chart-3/50" },
  magenta: { trace: "stroke-chart-4", afterglow: "stroke-chart-4/50" },
  chrome: { trace: "stroke-chart-5", afterglow: "stroke-chart-5/50" },
} as const satisfies {
  readonly [C in TraceColor]: {
    readonly trace: string;
    readonly afterglow: string;
  };
};

const checked = new WeakMap<WavePlayerLook, WavePlayerLook>();

/**
 * The boundary for a site's look, which arrives as stored JSON whatever its
 * type says. Returns the look with its config set to draw the audio, so
 * the screen draws the track, and the still as given. One look object comes
 * back as one checked object on every parse, so a site that memoizes
 * parseWaveformConfig(look.config) on the look parses nothing again.
 * Returns null when the look isn't a config object and a still the box can
 * draw: an object or axis missing, an unknown wave or color, cycles that
 * aren't whole numbers from 1 to 16, or a phase that isn't finite. It never
 * throws, so a bad look costs its track the look, not the track.
 */
export function checkLook(look: WavePlayerLook): WavePlayerLook | null {
  if (
    !isRecord(look) ||
    !isRecord(look.config) ||
    !isRecord(look.still) ||
    !drawable(look.still.x) ||
    !drawable(look.still.y) ||
    !Object.hasOwn(STILL_STROKE, look.still.color)
  )
    return null;

  const known = checked.get(look);

  if (known !== undefined) return known;

  const playing = { config: playerConfig(look.config), still: look.still };

  checked.set(look, playing);

  return playing;
}

/**
 * The config with the audio as its source. A screen form with a ratio of
 * its own draws that ratio's tones and never the audio, as
 * kevelle/waveform's figureFor() rules, so its ratio becomes the tones'
 * and the screen draws the shared figure: the music while it plays, and
 * while the audio is silent the same ratio, and so the same still, with
 * the look's own motion and detune, as every shared figure has. A figure
 * that isn't a known ratio, which the waveform's parser reads as "shared",
 * changes nothing.
 */
function playerConfig(config: LookRecord) {
  const playing = { ...config, source: "audio" };
  const { forms, tones } = config;

  if (!isRecord(forms) || !isRecord(forms.screen)) return playing;

  const { figure } = forms.screen;
  const ratio = RATIO_IDS.find((id) => id === figure);

  if (ratio === undefined) return playing;

  const screen = { ...forms.screen, figure: "shared" };

  return {
    ...playing,
    tones: isRecord(tones) ? { ...tones, ratio } : { ratio },
    forms: { ...forms, screen },
  };
}

function isRecord(value: LookValue | undefined): value is LookRecord {
  return value instanceof Object && !Array.isArray(value);
}

function drawable(axis: StillAxis): boolean {
  return (
    isRecord(axis) &&
    Object.hasOwn(WAVE, axis.wave) &&
    Number.isInteger(axis.cycles) &&
    axis.cycles >= 1 &&
    axis.cycles <= MAX_CYCLES &&
    Number.isFinite(axis.phase)
  );
}

/** The figure's viewBox side, the Paper card's 316px screen. Every box scales it to fit. */
export const STILL_VIEWBOX = 316;

/** Samples per cycle of the busier axis. The Paper figure's 5:4 takes 220. */
const STEPS_PER_CYCLE = 44;

/** How far the afterglow runs behind the trace on X, in radians. */
const AFTERGLOW_LAG = 0.12;

/**
 * The still as SVG paths in the 316 viewBox, 40 units inside each edge:
 * x = 158 + 118 · wave(x) and y = 158 - 118 · wave(y), each wave at
 * 2π · cycles · t + phase. Y runs up, as on the phosphor screen, so the
 * still faces the way the live figure does. The afterglow is the same
 * figure 0.12 rad behind on X. Pure, so the server and the client draw the
 * same strings.
 */
export function stillPaths(still: WavePlayerStill) {
  return {
    trace: path(still, still.x.phase),
    afterglow: path(still, still.x.phase - AFTERGLOW_LAG),
  };
}

function path({ x, y }: WavePlayerStill, phase: number): string {
  const center = STILL_VIEWBOX / 2;
  const radius = center - 40;
  const steps = STEPS_PER_CYCLE * Math.max(x.cycles, y.cycles);

  const points = Array.from({ length: steps + 1 }, (_, step) => {
    const t = (2 * Math.PI * step) / steps;
    const px = center + radius * WAVE[x.wave](x.cycles * t + phase);
    const py = center - radius * WAVE[y.wave](y.cycles * t + y.phase);

    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  });

  return `M${points.join("L")}Z`;
}

const keys = new WeakMap<WavePlayerLook, string>();

/** The look's content as one string, made once per look object. */
function keyOf(look: WavePlayerLook): string {
  const known = keys.get(look);

  if (known !== undefined) return known;

  const key = JSON.stringify(look);

  keys.set(look, key);

  return key;
}

/**
 * The look a snapshot shows: the current track's, else the default.
 * `previous` comes back while the content is the same, so a fresh list of
 * the same tracks, an edit to another track, and a move between two tracks
 * with equal looks keep one object, and a site that memoizes on it parses
 * nothing again.
 */
export function currentLook(
  track: WavePlayerLook | null,
  previous: WavePlayerLook | null
): WavePlayerLook {
  const look = track ?? DEFAULT_LOOK;

  return previous !== null &&
    (previous === look || keyOf(previous) === keyOf(look))
    ? previous
    : look;
}

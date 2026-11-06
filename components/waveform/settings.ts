import { TONE_LIMITS, clampNumber, toSeconds, type Wave } from "@/lib/audio";
import {
  LOOK_LIMITS,
  SCREEN_PRESETS,
  type BeamStyle,
  type ScreenPresetId,
  type TraceColor,
} from "@/lib/phosphor";
import {
  DEFAULT_DISPLAY,
  DISPLAY_LIMITS,
  TIMEBASES,
  type DisplaySettings,
  type Timebase,
} from "@/lib/scope";

/** The four places the one waveform appears. This tuple is the only list of forms. */
export const FORMS = ["stage", "glow", "screen", "mark"] as const;

export type Form = (typeof FORMS)[number];

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * X:Y frequency ratios. `y` is Y's frequency as a multiple of X's. The
 * harmonic set closes into a still figure; the golden set never closes, so
 * its lattice keeps drifting. 1:φ nearly closes every 8 cycles, as 13/8
 * approximates φ, so it drifts as a crisp diamond lattice.
 */
export const RATIOS = {
  "1:1": { label: "1:1", y: 1, set: "harmonic" },
  "2:1": { label: "2:1", y: 1 / 2, set: "harmonic" },
  "3:2": { label: "3:2", y: 2 / 3, set: "harmonic" },
  "4:3": { label: "4:3", y: 3 / 4, set: "harmonic" },
  "5:4": { label: "5:4", y: 4 / 5, set: "harmonic" },
  "1:2": { label: "1:2", y: 2, set: "harmonic" },
  "3:1": { label: "3:1", y: 1 / 3, set: "harmonic" },
  "5:3": { label: "5:3", y: 3 / 5, set: "harmonic" },
  "8:5": { label: "8:5", y: 5 / 8, set: "harmonic" },
  "1:phi": { label: "1:φ", y: PHI, set: "golden" },
  "phi:1": { label: "φ:1", y: 1 / PHI, set: "golden" },
  "1:phi2": { label: "1:φ²", y: PHI ** 2, set: "golden" },
  "2:phi": { label: "2:φ", y: PHI / 2, set: "golden" },
} as const satisfies Record<
  string,
  { label: string; y: number; set: "harmonic" | "golden" }
>;

export type RatioId = keyof typeof RATIOS;

/** Phase in radians, 0 to 2π, as on the Oscilloscope. */
export type Oscillator = {
  readonly wave: Wave;
  /** -100 to 100 cents. */
  readonly detuneCents: number;
  readonly phase: number;
};

export type Tones = {
  /** X plays left. */
  readonly x: Oscillator & { readonly hz: number };
  /** Y plays right, at a ratio to X or at its own frequency. */
  readonly y: Oscillator;
  readonly ratio: RatioId | "free";
  /**
   * Y's frequency while the ratio is free. While locked it keeps its last
   * value. Picking Free sets it to what the lock was drawing, clamped to the
   * free range of 20 to 2,000 Hz as on the Oscilloscope, so the figure holds
   * whenever the lock drew Y inside that range.
   */
  readonly yHz: number;
};

export type Motion = {
  /** Hz added to Y, -2 to 2: precesses a closed figure once every 1 / drift seconds. */
  readonly drift: number;
  /** Cents, 0 to 200: Y's frequency swings by this much, so the lattice opens and closes. */
  readonly wander: number;
  /** How often the wander swings, 0.01 to 1 Hz. */
  readonly wanderRate: number;
  /** Turns, 0 to 1. */
  readonly rotation: number;
  /** Turns per second, -0.25 to 0.25. */
  readonly spin: number;
  /** Copies of the figure, 1 to 8, a 1 / n turn apart. */
  readonly symmetry: number;
  /** Adds a reflected copy of each. */
  readonly mirror: boolean;
};

/** "auto": astral on a light page. On a dark one, P31's own green on P31 and phosphor on any other screen. */
export type FigureColor = "auto" | TraceColor;

/** How the phosphor draws. Shared by every form, so the four read as one instrument. */
export type Look = {
  readonly screen: ScreenPresetId;
  readonly color: FigureColor;
  /** YT channel 2. */
  readonly color2: TraceColor;
  readonly beam: BeamStyle;
  readonly persistence: number;
  readonly bloom: number;
  readonly focus: number;
  readonly intensity: number;
  readonly hdr: boolean;
};

/**
 * What a form draws. "shared" is the config's figure. A ratio is a
 * simplified version of it, with Y locked to that ratio, that turns with
 * it and drifts slowly.
 * figureFor() in ./figure.ts lists what it keeps.
 */
export type FormFigure = "shared" | RatioId;

export type FormSettings = {
  readonly figure: FormFigure;
  /** Share of the frame, 0.25 to 2. Above 1 zooms into the lattice. */
  readonly size: number;
  /** Canvas opacity, 0 to 1. */
  readonly strength: number;
  /** CSS blur in px, 0 to 16. */
  readonly depth: number;
  /** How much the audio and strikes move it, 0 to 1. */
  readonly reactivity: number;
};

export type WaveformConfig = {
  /** "audio" draws the provider's feed while it carries signal, and the tones otherwise. */
  readonly source: "tones" | "audio";
  readonly tones: Tones;
  readonly motion: Motion;
  readonly display: DisplaySettings;
  readonly look: Look;
  readonly forms: { readonly [F in Form]: FormSettings };
};

/** X's range and Y's free range, as on the Oscilloscope. */
export const HZ_RANGE = { min: 20, max: 2000 } as const;

/** Y's frequency before motion: the lock's multiple of X, or its own while free. */
export function yHzOf(tones: Tones): number {
  return tones.ratio === "free"
    ? tones.yHz
    : tones.x.hz * RATIOS[tones.ratio].y;
}

// Branch writers. Each replaces only the branch it changes, so untouched
// branches keep their identity. The scope resets a display when its
// settings object changes, so display.xy and display.yt must stay the same
// objects until they do.

const withTones = (config: WaveformConfig, tones: Partial<Tones>) => ({
  ...config,
  tones: { ...config.tones, ...tones },
});

const withX = (config: WaveformConfig, x: Partial<Tones["x"]>) =>
  withTones(config, { x: { ...config.tones.x, ...x } });

const withY = (config: WaveformConfig, y: Partial<Oscillator>) =>
  withTones(config, { y: { ...config.tones.y, ...y } });

const withMotion = (config: WaveformConfig, motion: Partial<Motion>) => ({
  ...config,
  motion: { ...config.motion, ...motion },
});

const withDisplay = (
  config: WaveformConfig,
  display: Partial<DisplaySettings>
) => ({ ...config, display: { ...config.display, ...display } });

const withXy = (config: WaveformConfig, xy: Partial<DisplaySettings["xy"]>) =>
  withDisplay(config, { xy: { ...config.display.xy, ...xy } });

const withYt = (config: WaveformConfig, yt: Partial<DisplaySettings["yt"]>) =>
  withDisplay(config, { yt: { ...config.display.yt, ...yt } });

const withTrigger = (
  config: WaveformConfig,
  trigger: Partial<DisplaySettings["yt"]["trigger"]>
) => withYt(config, { trigger: { ...config.display.yt.trigger, ...trigger } });

const withLook = (config: WaveformConfig, look: Partial<Look>) => ({
  ...config,
  look: { ...config.look, ...look },
});

const withForm = (
  config: WaveformConfig,
  form: Form,
  settings: Partial<FormSettings>
) => ({
  ...config,
  forms: {
    ...config.forms,
    [form]: { ...config.forms[form], ...settings },
  },
});

export type ControlGroup =
  | "figure"
  | "motion"
  | "display"
  | "light"
  | "forms"
  | "source";

/** Facts outside the config that decide whether a control can change the picture. */
export type ControlContext = { readonly hdrDisplay: boolean };

/**
 * What a control needs before it changes the picture. While it isn't met,
 * the panel disables the control and shows `reason`, or hides it when
 * `reason` is null, as for a control of the other display mode. A control
 * lists its requirements in order, and the first one unmet decides.
 */
export type Requirement = {
  readonly met: (config: WaveformConfig, context: ControlContext) => boolean;
  readonly reason: string | null;
  /**
   * The write that meets it, for a key that moves the control anyway, as
   * Free meets Y's frequency's need. It reads the config only. Without one,
   * no key may sweep the control.
   */
  readonly meet?: (config: WaveformConfig) => WaveformConfig;
};

type ControlBase = {
  readonly group: ControlGroup;
  readonly label: string;
  /** What the control does to the picture. */
  readonly effect: string;
  readonly needs?: readonly Requirement[];
};

export type NumberControl = ControlBase & {
  readonly kind: "number";
  readonly min: number;
  readonly max: number;
  /** The slider's step. A log control's slider moves by ratio instead. */
  readonly step: number;
  /** "log" spaces the slider by ratio; "cyclic" wraps past either end. */
  readonly scale: "linear" | "log" | "cyclic";
  /** One key press: an amount, or a factor on a log control. */
  readonly nudge: number;
  format(value: number): string;
  read(config: WaveformConfig): number;
  set(config: WaveformConfig, value: number): WaveformConfig;
};

export type ChoiceOption<V> = { readonly value: V; readonly label: string };

export type ChoiceControl<V extends string | number = string | number> =
  ControlBase & {
    readonly kind: "choice";
    readonly options: readonly ChoiceOption<V>[];
    /** Shows the options as wrapping chips instead of a menu. */
    readonly chips?: boolean;
    read(config: WaveformConfig): V;
    set(config: WaveformConfig, value: V): WaveformConfig;
    /**
     * A write that follows a pick in the panel or the keys, after set().
     * Never applied to a stored config, which keeps what it holds.
     */
    link?(before: WaveformConfig, after: WaveformConfig): WaveformConfig;
  };

export type SwitchControl = ControlBase & {
  readonly kind: "switch";
  read(config: WaveformConfig): boolean;
  set(config: WaveformConfig, value: boolean): WaveformConfig;
};

export type Control = NumberControl | ChoiceControl | SwitchControl;

type Leaf = string | number | boolean;

/** Every leaf of T as a dotted path, through each member of a union. */
type Paths<T> = T extends Leaf
  ? never
  : {
      [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Paths<T[K]>}`;
    }[keyof T & string];

/**
 * A control's id is its field's path in the stored JSON, so CONTROLS must
 * hold one control per field of WaveformConfig, and a field without one
 * fails to compile.
 */
export type ControlId = Paths<WaveformConfig>;

/** The settings table: one control for each ControlId, and no others. */
type ControlTable = { readonly [Id in ControlId]: Control };

const number = (control: Omit<NumberControl, "kind">): NumberControl => ({
  kind: "number",
  ...control,
});

const choice = <V extends string | number>(
  control: Omit<ChoiceControl<V>, "kind">
): ChoiceControl<V> => ({ kind: "choice", ...control });

const toggle = (control: Omit<SwitchControl, "kind">): SwitchControl => ({
  kind: "switch",
  ...control,
});

const signed = (value: number, digits: number) =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(digits)}`;

const hz = (value: number) => `${value.toFixed(value < 100 ? 2 : 1)} Hz`;

const degrees = (radians: number) =>
  `${Math.round((radians * 180) / Math.PI)}°`;

const WAVES: readonly ChoiceOption<Wave>[] = [
  { value: "sine", label: "Sine" },
  { value: "triangle", label: "Tri" },
  { value: "square", label: "Square" },
  { value: "saw", label: "Saw" },
];

const RATIO_OPTIONS: readonly ChoiceOption<RatioId>[] = Object.entries(
  RATIOS
).map(([value, ratio]) => ({
  // SAFETY: Object.entries of RATIOS yields its own keys, the RatioId union.
  value: value as RatioId,
  label: ratio.label,
}));

const TRACE_COLORS: readonly ChoiceOption<TraceColor>[] = [
  { value: "screen", label: "Screen" },
  { value: "phosphor", label: "Phosphor" },
  { value: "astral", label: "Astral" },
  { value: "flame", label: "Flame" },
  { value: "magenta", label: "Magenta" },
  { value: "chrome", label: "Chrome" },
];

const XY_MODE: Requirement = {
  met: (config) => config.display.mode === "xy",
  reason: null,
};

const YT_MODE: Requirement = {
  met: (config) => config.display.mode === "yt",
  reason: null,
};

const GAUSSIAN: Requirement = {
  met: (config) => config.look.beam === "gaussian",
  reason: "Needs the gaussian beam.",
};

/** The tones are one signal when they match, and XY draws a delay plot of it. */
function tonesMatch(tones: Tones): boolean {
  return (
    tones.ratio === "1:1" &&
    tones.x.wave === tones.y.wave &&
    tones.x.detuneCents === tones.y.detuneCents &&
    tones.x.phase === tones.y.phase
  );
}

function formControls(form: Form) {
  return {
    figure: choice<FormFigure>({
      group: "forms",
      label: "Figure",
      effect:
        "Shared draws the page's figure. A ratio draws a simpler one from the same waves and phases at that ratio, which turns with the page's and drifts slowly.",
      options: [{ value: "shared", label: "Shared" }, ...RATIO_OPTIONS],
      read: (config) => config.forms[form].figure,
      set: (config, figure) => withForm(config, form, { figure }),
    }),
    size: number({
      group: "forms",
      label: "Size",
      effect:
        "The figure's share of its frame. Above 1 zooms into the lattice.",
      min: 0.25,
      max: 2,
      step: 0.01,
      scale: "linear",
      nudge: 0.05,
      format: (value) => `×${value.toFixed(2)}`,
      read: (config) => config.forms[form].size,
      set: (config, size) => withForm(config, form, { size }),
    }),
    strength: number({
      group: "forms",
      label: "Strength",
      effect: "How much of the light shows.",
      min: 0,
      max: 1,
      step: 0.01,
      scale: "linear",
      nudge: 0.05,
      format: (value) => `${Math.round(value * 100)}%`,
      read: (config) => config.forms[form].strength,
      set: (config, strength) => withForm(config, form, { strength }),
    }),
    depth: number({
      group: "forms",
      label: "Depth",
      effect: "Blurs the light, as if it sat further back.",
      min: 0,
      max: 16,
      step: 0.5,
      scale: "linear",
      nudge: 0.5,
      format: (value) => `${value.toFixed(1)} px`,
      read: (config) => config.forms[form].depth,
      set: (config, depth) => withForm(config, form, { depth }),
    }),
    reactivity: number({
      group: "forms",
      label: "Reactivity",
      effect: "How much the audio and strikes brighten and swell it.",
      min: 0,
      max: 1,
      step: 0.01,
      scale: "linear",
      nudge: 0.05,
      format: (value) => `${Math.round(value * 100)}%`,
      read: (config) => config.forms[form].reactivity,
      set: (config, reactivity) => withForm(config, form, { reactivity }),
    }),
  };
}

const STAGE = formControls("stage");

const GLOW = formControls("glow");

const SCREEN = formControls("screen");

const MARK = formControls("mark");

/** The ratio, named so Y's frequency can meet its need through it. */
const RATIO = choice<RatioId | "free">({
  group: "figure",
  label: "Ratio",
  effect: "X against Y. Whole ratios close; golden ones keep drifting.",
  chips: true,
  options: [...RATIO_OPTIONS, { value: "free", label: "Free" }],
  read: (config) => config.tones.ratio,
  set: (config, ratio) => withTones(config, { ratio }),
  link: (before, after) =>
    after.tones.ratio === "free" && before.tones.ratio !== "free"
      ? withTones(after, {
          yHz: clampNumber(yHzOf(before.tones), HZ_RANGE, HZ_RANGE.min),
        })
      : after,
});

export const CONTROLS: ControlTable = {
  "tones.ratio": RATIO,
  "tones.x.hz": number({
    group: "figure",
    label: "X frequency",
    effect: "The figure's density. Y follows while a ratio locks it.",
    ...HZ_RANGE,
    step: 0.1,
    scale: "log",
    nudge: 2 ** (1 / 12),
    format: hz,
    read: (config) => config.tones.x.hz,
    set: (config, value) => withX(config, { hz: value }),
  }),
  "tones.yHz": number({
    group: "figure",
    label: "Y frequency",
    effect: "Y's own frequency, against X's.",
    needs: [
      {
        met: (config) => config.tones.ratio === "free",
        reason: "The ratio sets it. Pick Free to tune Y.",
        // Free starts Y at the pitch the lock drew, so nothing jumps.
        meet: (config) => writeChoice(config, RATIO, "free"),
      },
    ],
    ...HZ_RANGE,
    step: 0.1,
    scale: "log",
    nudge: 2 ** (1 / 12),
    format: hz,
    // While locked this reads what the lock draws, clamped to the free range,
    // so Y keeps its frequency when it goes free if the lock drew it in range.
    read: (config) => clampNumber(yHzOf(config.tones), HZ_RANGE, HZ_RANGE.min),
    set: (config, yHz) => withTones(config, { yHz }),
  }),
  "tones.x.wave": choice<Wave>({
    group: "figure",
    label: "X wave",
    effect: "Curves, corners, and zigzags across.",
    options: WAVES,
    read: (config) => config.tones.x.wave,
    set: (config, wave) => withX(config, { wave }),
  }),
  "tones.y.wave": choice<Wave>({
    group: "figure",
    label: "Y wave",
    effect: "Curves, corners, and zigzags up and down.",
    options: WAVES,
    read: (config) => config.tones.y.wave,
    set: (config, wave) => withY(config, { wave }),
  }),
  "tones.x.detuneCents": number({
    group: "figure",
    label: "X detune",
    effect: "A few cents makes a closed figure breathe.",
    ...TONE_LIMITS.detuneCents,
    step: 1,
    scale: "linear",
    nudge: 1,
    format: (value) => `${signed(value, 0)} ct`,
    read: (config) => config.tones.x.detuneCents,
    set: (config, detuneCents) => withX(config, { detuneCents }),
  }),
  "tones.y.detuneCents": number({
    group: "figure",
    label: "Y detune",
    effect: "A few cents makes a closed figure breathe.",
    ...TONE_LIMITS.detuneCents,
    step: 1,
    scale: "linear",
    nudge: 1,
    format: (value) => `${signed(value, 0)} ct`,
    read: (config) => config.tones.y.detuneCents,
    set: (config, detuneCents) => withY(config, { detuneCents }),
  }),
  "tones.x.phase": number({
    group: "figure",
    label: "X phase",
    effect: "Turns the figure's loops against each other.",
    ...TONE_LIMITS.phase,
    step: Math.PI / 180,
    scale: "cyclic",
    nudge: Math.PI / 36,
    format: degrees,
    read: (config) => config.tones.x.phase,
    set: (config, phase) => withX(config, { phase }),
  }),
  "tones.y.phase": number({
    group: "figure",
    label: "Y phase",
    effect: "Turns the figure's loops against each other.",
    ...TONE_LIMITS.phase,
    step: Math.PI / 180,
    scale: "cyclic",
    nudge: Math.PI / 36,
    format: degrees,
    read: (config) => config.tones.y.phase,
    set: (config, phase) => withY(config, { phase }),
  }),
  "motion.drift": number({
    group: "motion",
    label: "Drift",
    effect: "Hz added to Y. A closed figure turns over once every 1 / drift s.",
    min: -2,
    max: 2,
    step: 0.01,
    scale: "linear",
    nudge: 0.01,
    format: (value) => `${signed(value, 2)} Hz`,
    read: (config) => config.motion.drift,
    set: (config, drift) => withMotion(config, { drift }),
  }),
  "motion.wander": number({
    group: "motion",
    label: "Wander",
    effect: "Swings Y's frequency, so the lattice opens and closes.",
    min: 0,
    max: 200,
    step: 1,
    scale: "linear",
    nudge: 5,
    format: (value) => `${Math.round(value)} ct`,
    read: (config) => config.motion.wander,
    set: (config, wander) => withMotion(config, { wander }),
  }),
  "motion.wanderRate": number({
    group: "motion",
    label: "Wander rate",
    effect: "How often the wander swings.",
    needs: [
      {
        met: (config) => config.motion.wander > 0,
        reason: "Set Wander above 0 first.",
      },
    ],
    min: 0.01,
    max: 1,
    step: 0.01,
    scale: "log",
    nudge: 2 ** (1 / 4),
    format: (value) => `${value.toFixed(2)} Hz`,
    read: (config) => config.motion.wanderRate,
    set: (config, wanderRate) => withMotion(config, { wanderRate }),
  }),
  "motion.rotation": number({
    group: "motion",
    label: "Rotation",
    effect: "Turns the whole figure.",
    min: 0,
    max: 1,
    step: 1 / 360,
    scale: "cyclic",
    nudge: 1 / 72,
    format: (value) => `${Math.round(value * 360)}°`,
    read: (config) => config.motion.rotation,
    set: (config, rotation) => withMotion(config, { rotation }),
  }),
  "motion.spin": number({
    group: "motion",
    label: "Spin",
    effect: "Turns the figure continuously, in turns per second.",
    min: -0.25,
    max: 0.25,
    step: 0.005,
    scale: "linear",
    nudge: 0.005,
    format: (value) => `${signed(value, 3)}/s`,
    read: (config) => config.motion.spin,
    set: (config, spin) => withMotion(config, { spin }),
  }),
  "motion.symmetry": number({
    group: "motion",
    label: "Symmetry",
    effect: "Copies of the figure, evenly turned.",
    min: 1,
    max: 8,
    step: 1,
    scale: "linear",
    nudge: 1,
    format: (value) => `×${Math.round(value)}`,
    read: (config) => config.motion.symmetry,
    set: (config, symmetry) =>
      withMotion(config, { symmetry: Math.round(symmetry) }),
  }),
  "motion.mirror": toggle({
    group: "motion",
    label: "Mirror",
    effect: "Adds a reflected copy of each.",
    read: (config) => config.motion.mirror,
    set: (config, mirror) => withMotion(config, { mirror }),
  }),
  "display.mode": choice<DisplaySettings["mode"]>({
    group: "display",
    label: "Mode",
    effect: "XY draws X against Y; YT sweeps each across time.",
    options: [
      { value: "xy", label: "XY" },
      { value: "yt", label: "YT" },
    ],
    read: (config) => config.display.mode,
    set: (config, mode) => withDisplay(config, { mode }),
  }),
  "display.xy.axes": choice<DisplaySettings["xy"]["axes"]>({
    group: "display",
    label: "Axes",
    effect: "L/R draws X against Y. M/S turns the figure 45°.",
    needs: [XY_MODE],
    options: [
      { value: "lr", label: "L/R" },
      { value: "ms", label: "M/S" },
    ],
    read: (config) => config.display.xy.axes,
    set: (config, axes) => withXy(config, { axes }),
  }),
  "display.xy.delay": number({
    group: "display",
    label: "Delay",
    effect: "A mono signal draws against itself this much later.",
    needs: [
      XY_MODE,
      {
        met: (config) => config.source === "audio" || tonesMatch(config.tones),
        reason: "Draws only a mono signal, such as two matching tones at 1:1.",
      },
    ],
    ...DISPLAY_LIMITS.delay,
    step: 1e-5,
    scale: "log",
    nudge: 2 ** (1 / 4),
    format: (value) => `${(value * 1000).toFixed(2)} ms`,
    read: (config) => config.display.xy.delay,
    set: (config, delay) => withXy(config, { delay: toSeconds(delay) }),
  }),
  "display.yt.timebase": choice<Timebase>({
    group: "display",
    label: "Timebase",
    effect: "How much time one sweep spans.",
    needs: [YT_MODE],
    options: TIMEBASES.map((value) => ({
      value,
      label:
        value < 1e-3 ? `${Math.round(value * 1e6)} µs` : `${value * 1000} ms`,
    })),
    read: (config) => config.display.yt.timebase,
    set: (config, timebase) => withYt(config, { timebase }),
  }),
  "display.yt.channels": choice<DisplaySettings["yt"]["channels"]>({
    group: "display",
    label: "Channels",
    effect: "Which traces sweep.",
    needs: [YT_MODE],
    options: [
      { value: "1", label: "X" },
      { value: "2", label: "Y" },
      { value: "both", label: "Both" },
    ],
    read: (config) => config.display.yt.channels,
    set: (config, channels) => withYt(config, { channels }),
  }),
  "display.yt.trigger.channel": choice<0 | 1>({
    group: "display",
    label: "Trigger",
    effect: "The trace that starts each sweep.",
    needs: [YT_MODE],
    options: [
      { value: 0, label: "X" },
      { value: 1, label: "Y" },
    ],
    read: (config) => config.display.yt.trigger.channel,
    set: (config, channel) => withTrigger(config, { channel }),
  }),
  "display.yt.trigger.slope": choice<DisplaySettings["yt"]["trigger"]["slope"]>(
    {
      group: "display",
      label: "Slope",
      effect: "Starts each sweep on a rise or a fall.",
      needs: [YT_MODE],
      options: [
        { value: "rising", label: "Rising" },
        { value: "falling", label: "Falling" },
      ],
      read: (config) => config.display.yt.trigger.slope,
      set: (config, slope) => withTrigger(config, { slope }),
    }
  ),
  "display.yt.trigger.level": number({
    group: "display",
    label: "Level",
    effect: "Where on the wave each sweep starts.",
    needs: [YT_MODE],
    ...DISPLAY_LIMITS.triggerLevel,
    step: 0.01,
    scale: "linear",
    nudge: 0.05,
    format: (value) => signed(value, 2),
    read: (config) => config.display.yt.trigger.level,
    set: (config, level) => withTrigger(config, { level }),
  }),
  "display.yt.trigger.mode": choice<DisplaySettings["yt"]["trigger"]["mode"]>({
    group: "display",
    label: "Sweep",
    effect: "Auto free-runs, Normal waits, Single sweeps once per strike.",
    needs: [YT_MODE],
    options: [
      { value: "auto", label: "Auto" },
      { value: "normal", label: "Normal" },
      { value: "single", label: "Single" },
    ],
    read: (config) => config.display.yt.trigger.mode,
    set: (config, mode) => withTrigger(config, { mode }),
  }),
  "display.yt.pretrigger": number({
    group: "display",
    label: "Pretrigger",
    effect: "How much of each sweep comes before its start.",
    needs: [YT_MODE],
    ...DISPLAY_LIMITS.pretrigger,
    step: 0.05,
    scale: "linear",
    nudge: 0.05,
    format: (value) => `${Math.round(value * 100)}%`,
    read: (config) => config.display.yt.pretrigger,
    set: (config, pretrigger) => withYt(config, { pretrigger }),
  }),
  "display.yt.holdoff": number({
    group: "display",
    label: "Holdoff",
    effect: "A pause between sweeps.",
    needs: [YT_MODE],
    ...DISPLAY_LIMITS.holdoff,
    step: 0.01,
    scale: "linear",
    nudge: 0.01,
    format: (value) => `${Math.round(value * 1000)} ms`,
    read: (config) => config.display.yt.holdoff,
    set: (config, holdoff) => withYt(config, { holdoff: toSeconds(holdoff) }),
  }),
  "display.scale.kind": choice<DisplaySettings["scale"]["kind"]>({
    group: "display",
    label: "Scale",
    effect: "Auto lifts a quiet signal to fill the frame.",
    options: [
      { value: "auto", label: "Auto" },
      { value: "fixed", label: "Fixed" },
    ],
    read: (config) => config.display.scale.kind,
    set: (config, kind) =>
      config.display.scale.kind === kind
        ? config
        : withDisplay(config, {
            scale: kind === "auto" ? { kind } : { kind, gain: 1 },
          }),
  }),
  "display.scale.gain": number({
    group: "display",
    label: "Gain",
    effect: "Grows the figure past its frame or shrinks it.",
    needs: [
      {
        met: (config) => config.display.scale.kind === "fixed",
        reason: "Set Scale to Fixed.",
      },
    ],
    ...DISPLAY_LIMITS.gain,
    step: 0.01,
    scale: "log",
    nudge: 2 ** (1 / 4),
    format: (value) => `×${value.toFixed(2)}`,
    read: (config) =>
      config.display.scale.kind === "fixed" ? config.display.scale.gain : 1,
    set: (config, gain) =>
      config.display.scale.kind === "fixed"
        ? withDisplay(config, { scale: { kind: "fixed", gain } })
        : config,
  }),
  "look.color": choice<FigureColor>({
    group: "light",
    label: "Color",
    effect:
      "Auto is astral on light. On dark it is P31's own green on P31 and phosphor on any other screen. A signal color picks the Neutral screen.",
    chips: true,
    options: [{ value: "auto", label: "Auto" }, ...TRACE_COLORS],
    read: (config) => config.look.color,
    set: (config, color) => withLook(config, { color }),
    // A screen tints every trace, so a picked color draws true on Neutral.
    link: (before, after) => {
      const { color } = after.look;

      if (color === before.look.color || color === "screen") return after;

      return withLook(after, { screen: color === "auto" ? "p31" : "neutral" });
    },
  }),
  "look.screen": choice<ScreenPresetId>({
    group: "light",
    label: "Screen",
    effect: "The phosphor: its tint, tone, and how each color fades.",
    options: Object.values(SCREEN_PRESETS).map((screen) => ({
      value: screen.id,
      label: screen.label,
    })),
    read: (config) => config.look.screen,
    set: (config, screen) => withLook(config, { screen }),
  }),
  "look.color2": choice<TraceColor>({
    group: "light",
    label: "Color 2",
    effect:
      "The Y trace's color in YT. A signal color picks the Neutral screen.",
    needs: [
      {
        met: (config) =>
          config.display.mode === "yt" && config.display.yt.channels !== "1",
        reason: null,
      },
    ],
    chips: true,
    options: TRACE_COLORS,
    read: (config) => config.look.color2,
    set: (config, color2) => withLook(config, { color2 }),
    // As with Color, a picked color draws true on Neutral.
    link: (before, after) =>
      after.look.color2 === before.look.color2 || after.look.color2 === "screen"
        ? after
        : withLook(after, { screen: "neutral" }),
  }),
  "look.beam": choice<BeamStyle>({
    group: "light",
    label: "Beam",
    effect: "Line is the crisp 1 px trace. Gaussian glows where it slows.",
    options: [
      { value: "line", label: "Line" },
      { value: "gaussian", label: "Gaussian" },
    ],
    read: (config) => config.look.beam,
    set: (config, beam) => withLook(config, { beam }),
  }),
  "look.persistence": number({
    group: "light",
    label: "Trail",
    effect:
      "How long the light lingers. Past four copies the shortest trail grows, so a dense figure never flickers.",
    ...LOOK_LIMITS.persistence,
    step: 1,
    scale: "linear",
    nudge: 4,
    format: (value) => String(Math.round(value)),
    read: (config) => config.look.persistence,
    set: (config, persistence) => withLook(config, { persistence }),
  }),
  "look.bloom": number({
    group: "light",
    label: "Bloom",
    effect: "The close halo around the lines.",
    ...LOOK_LIMITS.bloom,
    step: 0.05,
    scale: "linear",
    nudge: 0.05,
    format: (value) => value.toFixed(2),
    read: (config) => config.look.bloom,
    set: (config, bloom) => withLook(config, { bloom }),
  }),
  "look.focus": number({
    group: "light",
    label: "Focus",
    effect: "The spot's width.",
    needs: [GAUSSIAN],
    ...LOOK_LIMITS.focus,
    step: 0.1,
    scale: "linear",
    nudge: 0.1,
    format: (value) => `${value.toFixed(1)} px`,
    read: (config) => config.look.focus,
    set: (config, focus) => withLook(config, { focus }),
  }),
  "look.intensity": number({
    group: "light",
    label: "Intensity",
    effect: "How much light the beam lays down, on the line and the gaussian.",
    ...LOOK_LIMITS.intensity,
    step: 0.05,
    scale: "log",
    nudge: 2 ** (1 / 4),
    format: (value) => `×${value.toFixed(2)}`,
    read: (config) => config.look.intensity,
    set: (config, intensity) => withLook(config, { intensity }),
  }),
  "look.hdr": toggle({
    group: "light",
    label: "HDR",
    effect: "Lifts the hottest light past white on a dark page.",
    needs: [
      {
        met: (_config, context) => context.hdrDisplay,
        reason: "Needs an HDR display.",
      },
    ],
    read: (config) => config.look.hdr,
    set: (config, hdr) => withLook(config, { hdr }),
  }),
  "forms.stage.figure": STAGE.figure,
  "forms.stage.size": STAGE.size,
  "forms.stage.strength": STAGE.strength,
  "forms.stage.depth": STAGE.depth,
  "forms.stage.reactivity": STAGE.reactivity,
  "forms.glow.figure": GLOW.figure,
  "forms.glow.size": GLOW.size,
  "forms.glow.strength": GLOW.strength,
  "forms.glow.depth": GLOW.depth,
  "forms.glow.reactivity": GLOW.reactivity,
  "forms.screen.figure": SCREEN.figure,
  "forms.screen.size": SCREEN.size,
  "forms.screen.strength": SCREEN.strength,
  "forms.screen.depth": SCREEN.depth,
  "forms.screen.reactivity": SCREEN.reactivity,
  "forms.mark.figure": MARK.figure,
  "forms.mark.size": MARK.size,
  "forms.mark.strength": MARK.strength,
  "forms.mark.depth": MARK.depth,
  "forms.mark.reactivity": MARK.reactivity,
  source: choice<WaveformConfig["source"]>({
    group: "source",
    label: "Source",
    effect: "Audio draws the music while it plays, and the tones otherwise.",
    options: [
      { value: "tones", label: "Tones" },
      { value: "audio", label: "Audio" },
    ],
    read: (config) => config.source,
    set: (config, source) => ({ ...config, source }),
  }),
};

/** Every control id, in table order: the panel's order within each group. */
// SAFETY: Object.keys of a literal typed by ControlId above returns exactly those keys.
export const CONTROL_IDS = Object.keys(CONTROLS) as ControlId[];

/** The form a forms control belongs to, so the panel shows one form's controls at a time. */
export function formOf(id: ControlId): Form | null {
  return FORMS.find((form) => id.startsWith(`forms.${form}.`)) ?? null;
}

/** The first requirement a control lacks now, or null when it changes the picture. */
export function unmetNeed(
  control: Control,
  config: WaveformConfig,
  context: ControlContext
): Requirement | null {
  return control.needs?.find((need) => !need.met(config, context)) ?? null;
}

/** No HDR display, for the needs a write can meet, which read the config only. */
const NO_CONTEXT: ControlContext = { hdrDisplay: false };

/**
 * `config` with each unmet need of `id` that a write can meet, met, in
 * order. The same object when none is unmet.
 */
export function meetNeeds(
  config: WaveformConfig,
  id: ControlId
): WaveformConfig {
  let next = config;

  for (const need of CONTROLS[id].needs ?? [])
    if (need.meet && !need.met(next, NO_CONTEXT)) next = need.meet(next);

  return next;
}

/** Whether a control changes the picture now, and so whether the panel enables it. */
export function controlApplies(
  control: Control,
  config: WaveformConfig,
  context: ControlContext
): boolean {
  return unmetNeed(control, config, context) === null;
}

/** A number in its control's range: wrapped on a cyclic control, clamped otherwise. */
function fitNumber(control: NumberControl, value: number): number {
  if (control.scale !== "cyclic")
    return clampNumber(value, control, control.min);

  const span = control.max - control.min;

  return control.min + ((((value - control.min) % span) + span) % span);
}

/** Sets a number control, fitted to its range. The same config back when nothing changed. */
export function writeNumber(
  config: WaveformConfig,
  control: NumberControl,
  value: number
): WaveformConfig {
  const next = fitNumber(control, value);

  return next === control.read(config) ? config : control.set(config, next);
}

/** Picks one of a choice's options and applies its linked write. */
export function writeChoice<V extends string | number>(
  config: WaveformConfig,
  control: ChoiceControl<V>,
  value: V
): WaveformConfig {
  if (value === control.read(config)) return config;

  const next = control.set(config, value);

  return control.link ? control.link(config, next) : next;
}

export function writeSwitch(
  config: WaveformConfig,
  control: SwitchControl,
  value: boolean
): WaveformConfig {
  return value === control.read(config) ? config : control.set(config, value);
}

/**
 * Moves a control by `steps` key presses: a number by its nudge (a factor on
 * a log control, wrapping on a cyclic one, clamped otherwise), a choice to
 * the next or previous option, clamped at the ends, and a switch over.
 */
export function nudgeControl(
  config: WaveformConfig,
  id: ControlId,
  steps: number
): WaveformConfig {
  const control = CONTROLS[id];

  switch (control.kind) {
    case "number": {
      const value = control.read(config);

      return writeNumber(
        config,
        control,
        control.scale === "log"
          ? value * control.nudge ** steps
          : value + control.nudge * steps
      );
    }

    case "choice": {
      const at = control.options.findIndex(
        (option) => option.value === control.read(config)
      );

      const option =
        control.options[
          Math.min(control.options.length - 1, Math.max(0, at + steps))
        ];

      return writeChoice(config, control, option.value);
    }

    case "switch":
      return writeSwitch(config, control, !control.read(config));
  }
}

/** The chips' order. The stage's number keys 1 to 9 and 0 pick the first ten. */
export const PRESET_ORDER = [
  "golden",
  "zigzag",
  "lattice",
  "mesh",
  "circle",
  "figure-eight",
  "lissajous-3-2",
  "breathing-detune",
  "corners",
  "rosette",
  "dual-trace",
] as const;

export type PresetId = (typeof PRESET_ORDER)[number];

/** A preset sets the tones, the motion, the display, and the look. The source and the forms stay the person's. */
export type Preset = {
  readonly label: string;
  readonly tones: Tones;
  readonly motion: Motion;
  readonly display: DisplaySettings;
  readonly look: Look;
};

const STILL: Motion = {
  drift: 0,
  wander: 0,
  wanderRate: 0.1,
  rotation: 0,
  spin: 0,
  symmetry: 1,
  mirror: false,
};

const sine = (phase = 0): Oscillator => ({
  wave: "sine",
  detuneCents: 0,
  phase,
});

/** A preset's look: the line beam on P31 in the theme's color at intensity 2, with this trail and bloom. */
const look = (
  persistence: number,
  bloom: number,
  overrides: Partial<Look> = {}
): Look => ({
  screen: "p31",
  color: "auto",
  color2: "flame",
  beam: "line",
  persistence,
  bloom,
  focus: 1.2,
  intensity: 2,
  hdr: false,
  ...overrides,
});

/** Tones with Y locked to a ratio. yHz holds what the lock draws, so Free starts there. */
const locked = (x: Tones["x"], y: Oscillator, ratio: RatioId): Tones => ({
  x,
  y,
  ratio,
  yHz: clampNumber(x.hz * RATIOS[ratio].y, HZ_RANGE, HZ_RANGE.min),
});

const free = (x: Tones["x"], y: Oscillator, yHz: number): Tones => ({
  x,
  y,
  ratio: "free",
  yHz,
});

/** The KKB Oscilloscope boards' X: 140 Hz, a quarter turn ahead, 3 cents sharp. */
const BOARD_X: Tones["x"] = { ...sine(Math.PI / 2), detuneCents: 3, hz: 140 };

/**
 * Golden is the default: 1:φ at 140 Hz on the board's X, which
 * drifts as a crisp diamond lattice. Zigzag and Lattice are the KKB
 * Oscilloscope boards' figures, 140 Hz against 601 Hz and 655 Hz. Mesh,
 * Circle, Figure eight, Lissajous 3:2, Breathing detune, Corners, and Dual
 * trace port the Kevelle Oscilloscope's presets with their numbers. Rosette
 * shows the motion controls: 3:2 in six slowly turning copies.
 *
 * Every preset draws at intensity 2, twice the original Oscilloscope's light
 * at 60 Hz, because that matches the brightness of the KKB Oscilloscope board
 * captures.
 */
export const PRESETS = {
  golden: {
    label: "Golden",
    tones: locked(BOARD_X, sine(), "1:phi"),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(114, 0.9),
  },
  zigzag: {
    label: "Zigzag",
    tones: free(BOARD_X, sine(), 601),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(114, 0.9),
  },
  lattice: {
    label: "Lattice",
    tones: free(BOARD_X, sine(), 655),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(114, 0.9),
  },
  mesh: {
    label: "Mesh",
    tones: free(BOARD_X, sine(), 631),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(114, 0.9),
  },
  circle: {
    label: "Circle",
    tones: locked({ ...sine(Math.PI / 2), hz: 220 }, sine(), "1:1"),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(64, 0.75),
  },
  "figure-eight": {
    label: "Figure eight",
    tones: locked({ ...sine(), hz: 220 }, sine(), "2:1"),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(72, 0.8),
  },
  "lissajous-3-2": {
    label: "Lissajous 3:2",
    tones: locked({ ...sine(), hz: 300 }, sine(), "3:2"),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(84, 0.85),
  },
  "breathing-detune": {
    label: "Breathing detune",
    tones: locked(
      { ...sine(Math.PI / 2), detuneCents: 3, hz: 220 },
      sine(),
      "1:1"
    ),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(96, 0.9),
  },
  corners: {
    label: "Corners",
    tones: locked(
      { wave: "square", detuneCents: 0, phase: Math.PI / 2, hz: 110 },
      { wave: "square", detuneCents: 0, phase: 0 },
      "1:1"
    ),
    motion: STILL,
    display: DEFAULT_DISPLAY,
    look: look(80, 0.8, { beam: "gaussian" }),
  },
  rosette: {
    label: "Rosette",
    tones: locked({ ...sine(Math.PI / 2), hz: 220 }, sine(), "3:2"),
    motion: { ...STILL, symmetry: 6, spin: 0.02 },
    display: DEFAULT_DISPLAY,
    look: look(96, 0.9),
  },
  "dual-trace": {
    label: "Dual trace",
    tones: locked(
      { ...sine(), hz: 220 },
      { wave: "triangle", detuneCents: 0, phase: 0 },
      "1:2"
    ),
    motion: STILL,
    display: { ...DEFAULT_DISPLAY, mode: "yt" },
    look: look(48, 0.6),
  },
} satisfies { readonly [P in PresetId]: Preset };

/** The config with the preset's tones, motion, display, and look. The source and the forms stay. */
export function applyPreset(
  config: WaveformConfig,
  id: PresetId
): WaveformConfig {
  const { tones, motion, display, look } = PRESETS[id];

  return { ...config, tones, motion, display, look };
}

/**
 * The preset the config draws, or null. It compares every figure, motion,
 * display, and light control that changes the picture, so a value a
 * control can't use, such as Y's frequency under a lock, never hides it.
 */
export function activePreset(
  config: WaveformConfig,
  context: ControlContext
): PresetId | null {
  const drawn = CONTROL_IDS.map((id) => CONTROLS[id]).filter(
    (control) =>
      control.group !== "forms" &&
      control.group !== "source" &&
      controlApplies(control, config, context)
  );

  return (
    PRESET_ORDER.find((id) => {
      const preset = applyPreset(config, id);

      return drawn.every(
        (control) => control.read(preset) === control.read(config)
      );
    }) ?? null
  );
}

/**
 * Each form's starting look. Every form draws the shared figure, and the
 * mark draws it simplified for 20 px, as figureFor() in ./figure.ts says.
 */
const FORM_DEFAULTS = {
  stage: {
    figure: "shared",
    size: 1,
    strength: 1,
    depth: 0,
    reactivity: 0.4,
  },
  glow: {
    figure: "shared",
    size: 1.3,
    strength: 0.3,
    depth: 6,
    reactivity: 0.25,
  },
  screen: {
    figure: "shared",
    size: 0.92,
    strength: 1,
    depth: 0,
    reactivity: 0.5,
  },
  mark: { figure: "shared", size: 0.9, strength: 1, depth: 0, reactivity: 0.3 },
} satisfies { readonly [F in Form]: FormSettings };

/** Golden on the tones, with each form's starting look. */
export const DEFAULT_WAVEFORM_CONFIG: WaveformConfig = {
  source: "tones",
  tones: PRESETS.golden.tones,
  motion: PRESETS.golden.motion,
  display: PRESETS.golden.display,
  look: PRESETS.golden.look,
  forms: FORM_DEFAULTS,
};

/** A JSON value: the most a store promises about what it hands back. */
export type StoredValue =
  | null
  | boolean
  | number
  | string
  | readonly StoredValue[]
  | StoredRecord;

export type StoredRecord = { readonly [key: string]: StoredValue | undefined };

function isRecord(value: StoredValue | undefined): value is StoredRecord {
  return value instanceof Object && !Array.isArray(value);
}

function isNumber(value: StoredValue | undefined): value is number {
  return Number.isFinite(value);
}

function isBoolean(value: StoredValue | undefined): value is boolean {
  return value === true || value === false;
}

/** The value at a control's path in stored JSON, or undefined. */
function storedAt(stored: StoredValue, id: ControlId): StoredValue | undefined {
  let value: StoredValue | undefined = stored;

  for (const key of id.split("."))
    value = isRecord(value) ? value[key] : undefined;

  return value;
}

/**
 * The config with one stored field written through its control: fitted
 * into its range or matched against its options, with no linked write. A
 * missing or bad value leaves the config as it was.
 */
function withStored(
  config: WaveformConfig,
  id: ControlId,
  raw: StoredValue | undefined
): WaveformConfig {
  const control = CONTROLS[id];

  switch (control.kind) {
    case "number":
      return isNumber(raw)
        ? control.set(config, fitNumber(control, raw))
        : config;

    case "choice": {
      const option = control.options.find((item) => item.value === raw);

      return option ? control.set(config, option.value) : config;
    }

    case "switch":
      return isBoolean(raw) ? control.set(config, raw) : config;
  }
}

/**
 * The one boundary for a stored config, such as a Convex document. Takes any
 * JSON and returns a whole config: each field a control reads is parsed
 * through its control, fitted into its range or matched against its
 * options, and a missing or bad field takes the default. Unknown fields are
 * dropped. Linked writes don't run, so a stored config keeps what it holds.
 */
export function parseWaveformConfig(value: StoredValue): WaveformConfig {
  return CONTROL_IDS.reduce(
    (config, id) => withStored(config, id, storedAt(value, id)),
    DEFAULT_WAVEFORM_CONFIG
  );
}

/** Whether a control's stored field differs from the default's. */
const differs = (config: WaveformConfig, id: ControlId) =>
  storedAt(config, id) !== storedAt(DEFAULT_WAVEFORM_CONFIG, id);

/**
 * The config with each of `ids` holding its field from
 * DEFAULT_WAVEFORM_CONFIG, written as parseWaveformConfig writes, so no
 * linked write runs. Returns `config` itself when every field already holds
 * its default, so `resetControls(config, ids) === config` means there is
 * nothing to reset. Branches it doesn't change keep their identity.
 */
export function resetControls(
  config: WaveformConfig,
  ids: readonly ControlId[]
): WaveformConfig {
  return ids.reduce(
    (next, id) =>
      differs(next, id)
        ? withStored(next, id, storedAt(DEFAULT_WAVEFORM_CONFIG, id))
        : next,
    config
  );
}

/** A draw from 0 up to 1, as Math.random returns. */
type Random = () => number;

const between = (random: Random, min: number, max: number) =>
  min + (max - min) * random();

/** Spread by ratio, as a log control's slider is. */
const betweenByRatio = (random: Random, min: number, max: number) =>
  min * (max / min) ** random();

/** Either sign, `min` to `max` from zero. */
const eitherWay = (random: Random, min: number, max: number) =>
  (random() < 0.5 ? -1 : 1) * between(random, min, max);

/** The cents that move `hz` by `by` hertz, since the same cents turn a high Y's figure faster. */
const centsMoving = (hz: number, by: number) => 1200 * Math.log2(1 + by / hz);

/** One of `options`, each as likely as its weight. */
function weighted<V>(
  random: Random,
  options: readonly (readonly [value: V, weight: number])[]
): V {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let left = random() * total;

  for (const [value, weight] of options) {
    left -= weight;

    if (left < 0) return value;
  }

  return options[options.length - 1][0];
}

const RANDOM_WAVES = [
  ["sine", 6],
  ["triangle", 2],
  ["square", 1],
  ["saw", 0.5],
] as const satisfies readonly (readonly [Wave, number])[];

const RATIO_IDS = RATIO_OPTIONS.map((option) => option.value);

/** A fraction p / q of 1.5 to 5, with q 1 to 4. */
function nearFraction(random: Random): number {
  const q = 1 + Math.floor(random() * 4);
  const p = Math.round(betweenByRatio(random, 1.5, 5) * q);

  return p / q;
}

/**
 * A new figure from `random`: the tones, the motion, and the light's beam,
 * trail, bloom, focus, and intensity, each drawn from about the presets'
 * own ranges, so a draw looks like a preset. The source, the display, the
 * forms, the colors, the screen, and HDR stay the config's. Each value is
 * written through its control, as parseWaveformConfig writes, so it fits
 * its range, and no linked write runs. One call is one edit, with no glide,
 * as a preset is.
 *
 * - X is 80 to 330 Hz by ratio. Y takes one of the ratios two times in
 *   three. Otherwise it is free, 0.02 to 0.15 Hz off a fraction of X with
 *   small terms, as the boards' Zigzag, Lattice, and Mesh sit near one.
 * - Each way a figure turns through its family stays slow: X's detune and
 *   the drift turn it by at most 0.2 Hz, and the wander swings Y by at most
 *   0.25 Hz. A figure that turns about once a second fills its trail solid.
 *   Each is off often, so most draws move in one or two ways.
 * - A figure that never closes, golden or free, draws sines, since corners
 *   and zigzags fill a drifting lattice solid.
 * - X's phase is 30° to 150° and Y's is 0, so a 1:1 of matching waves
 *   never draws a line.
 * - Up to 4 copies, a trail of 48 to 100, bloom 0.5 to 0.95, and intensity
 *   1 to 2, about the presets' light, so a dense draw stays open.
 */
export function randomFigure(
  config: WaveformConfig,
  random: Random = Math.random
): WaveformConfig {
  const x = betweenByRatio(random, 80, 330);

  const locked =
    random() < 0.35 ? null : RATIO_IDS[Math.floor(random() * RATIO_IDS.length)];

  // A locked Y's own frequency holds what the lock draws, as a preset's
  // does, so Free starts there.
  const yHz = locked
    ? x * RATIOS[locked].y
    : x * nearFraction(random) + eitherWay(random, 0.02, 0.15);

  const symmetry = random() < 0.55 ? 1 : 2 + Math.floor(random() * 3);

  const wander =
    random() < 0.75 ? 0 : centsMoving(yHz, between(random, 0.05, 0.25));

  const closes = locked !== null && RATIOS[locked].set === "harmonic";

  const wave = () => {
    const drawn = weighted(random, RANDOM_WAVES);

    return closes ? drawn : "sine";
  };

  const writes: readonly (readonly [ControlId, Leaf])[] = [
    ["tones.x.hz", x],
    ["tones.ratio", locked ?? "free"],
    ["tones.yHz", clampNumber(yHz, HZ_RANGE, HZ_RANGE.min)],
    ["tones.x.wave", wave()],
    ["tones.y.wave", wave()],
    // X's detune turns a locked figure at Y's multiple of it.
    [
      "tones.x.detuneCents",
      random() < 0.6
        ? 0
        : eitherWay(random, centsMoving(yHz, 0.05), centsMoving(yHz, 0.2)),
    ],
    ["tones.y.detuneCents", 0],
    ["tones.x.phase", between(random, Math.PI / 6, (5 * Math.PI) / 6)],
    ["tones.y.phase", 0],
    ["motion.drift", random() < 0.5 ? 0 : eitherWay(random, 0.02, 0.2)],
    ["motion.wander", wander],
    ["motion.wanderRate", betweenByRatio(random, 0.05, 0.3)],
    ["motion.rotation", random()],
    ["motion.spin", random() < 0.6 ? 0 : eitherWay(random, 0.005, 0.04)],
    ["motion.symmetry", symmetry],
    ["motion.mirror", symmetry <= 2 && random() < 0.15],
    ["look.beam", random() < 0.8 ? "line" : "gaussian"],
    ["look.persistence", between(random, 48, 100)],
    ["look.bloom", between(random, 0.5, 0.95)],
    ["look.focus", between(random, 0.9, 1.8)],
    ["look.intensity", betweenByRatio(random, 1, 2)],
  ];

  return writes.reduce(
    (next, [id, value]) => withStored(next, id, value),
    config
  );
}

/**
 * `search` with the config's query params in place of any it had: one param
 * per field that differs from DEFAULT_WAVEFORM_CONFIG, keyed by its control
 * id, as in ?tones.ratio=free&tones.yHz=655. Numbers write in their
 * shortest round-trip form, so a preset reads back exactly, choices write
 * their option's value, and switches write 1 or 0. Params that name no
 * control stay. The default config writes none, so its link is the bare
 * page. Returns "" or a string that starts with "?".
 */
export function writeWaveformSearch(
  search: string,
  config: WaveformConfig
): string {
  const params = new URLSearchParams(search);

  for (const id of CONTROL_IDS) {
    const value = storedAt(config, id);

    if (!differs(config, id) || value === undefined) params.delete(id);
    else params.set(id, isBoolean(value) ? (value ? "1" : "0") : String(value));
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

/** A query param as its control's JSON value. A malformed one parses to its default. */
function decodeParam(control: Control, raw: string): Leaf | undefined {
  switch (control.kind) {
    case "number":
      // Number("") is 0, so an empty value is malformed, not zero.
      return raw.trim() === "" ? undefined : Number(raw);

    case "choice":
      return control.options.find((option) => String(option.value) === raw)
        ?.value;

    case "switch":
      return raw === "1" ? true : raw === "0" ? false : undefined;
  }
}

type SearchRecord = { [key: string]: SearchRecord | Leaf };

/**
 * The config a search string from writeWaveformSearch names. Each param
 * that names a control becomes that control's JSON value at its path, and
 * the whole goes through parseWaveformConfig, so a malformed value takes its
 * default, an out-of-range one is fitted into its range, and unknown params
 * are ignored. A search that names no control returns
 * DEFAULT_WAVEFORM_CONFIG itself.
 */
export function readWaveformSearch(search: string): WaveformConfig {
  const params = new URLSearchParams(search);
  const stored: SearchRecord = {};

  for (const id of CONTROL_IDS) {
    const raw = params.get(id);
    const value = raw === null ? undefined : decodeParam(CONTROLS[id], raw);

    if (value === undefined) continue;

    const path = id.split(".");
    const leaf = path.pop() ?? id;
    let at = stored;

    for (const key of path) {
      const inner = at[key];
      const next: SearchRecord = inner instanceof Object ? inner : {};

      at[key] = next;
      at = next;
    }

    at[leaf] = value;
  }

  return parseWaveformConfig(stored);
}

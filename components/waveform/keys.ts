import type { SampleFeed } from "@/lib/audio";

import { MOVE_MS } from "./figure";
import {
  CONTROLS,
  CONTROL_IDS,
  HZ_RANGE,
  PRESET_ORDER,
  applyPreset,
  meetNeeds,
  nudgeControl,
  writeNumber,
  yHzOf,
  type ControlId,
  type NumberControl,
  type WaveformConfig,
} from "./settings";

/** Draft copy for Kalyn to rewrite: every string the keys show or announce. */
export const COPY = {
  stage: "Waveform. Press to strike it.",
  hint: "Type to play. Press ? for the keys.",
  strikeHint: "Press Enter or Space to strike it.",
  guide: "Keys",
  focusOnly: "They play while the waveform has focus.",
  pageWide: "They play anywhere on this page, but not in a text field.",
  faster: "Hold Shift to sweep four times as fast.",
  pageKeys: "Keys on this page",
  notes: { label: "A to K, W E T Y U", does: "Notes" },
  yHz: { label: "Z X", does: "Y frequency" },
  xHz: { label: "C V", does: "X frequency" },
  ratio: { label: "N M", does: "Ratio" },
  turn: { label: "← →", does: "Turn" },
  phase: { label: "↓ ↑", does: "Phase" },
  wave: { label: ", .", does: "Wave" },
  copies: { label: "; '", does: "Copies" },
  drift: { label: "[ ]", does: "Drift" },
  size: { label: "- =", does: "Size" },
  presets: { label: "1 to 0", does: "Presets" },
  strike: { label: "Space", does: "Strike" },
  home: { label: "Esc", does: "Back to the page's figure" },
  help: { label: "?", does: "Show or hide these keys" },
} as const;

/** What the guide shows for an entry: its keys, and what they do. */
type KeyText = { readonly label: string; readonly does: string };

/**
 * An entry's keys are KeyboardEvent.code values, for a key's place on the
 * board, such as "KeyA" or "BracketRight", or KeyboardEvent.key values, for
 * the character it types, such as "a". A single letter matches either case.
 */
type Entry = KeyText & {
  /** The punch the first press adds, 0 to 0.9, so a press is felt. Never on auto-repeat. */
  readonly touch: number;
};

/** Two keys step one number control down and up at each press, and sweep it while held. */
type SweepEntry = Entry & {
  readonly kind: "sweep";
  readonly keys: readonly [down: string, up: string];
  /** A number control outside the display group. */
  readonly id: ControlId;
  /** The control's own nudges every press steps, gliding over TAP_MS before the sweep starts. */
  readonly tap: number;
  /** The control's own nudges a second at full speed. */
  readonly perSecond: number;
};

/** Two keys move one control by a nudge or an option, again on auto-repeat. */
type StepEntry = Entry & {
  readonly kind: "step";
  readonly keys: readonly [down: string, up: string];
  readonly id: ControlId;
};

/** Each key makes its own edit, by its index in `keys`. Auto-repeat does nothing. */
type PickEntry = Entry & {
  readonly kind: "pick";
  readonly keys: readonly string[];
  /**
   * The config the press lands on, from where the presses so far land. The
   * same object declines the press. `heard` is that landing with the held
   * sweeps where they are at the press, for an edit that reads a pitch, so a
   * note played over a held X sweep is in tune with the X that sounds.
   */
  readonly edit: (
    config: WaveformConfig,
    index: number,
    shift: boolean,
    heard: WaveformConfig
  ) => WaveformConfig;
  readonly glideMs: number;
  /** Starts the tones together again as the glide lands. */
  readonly cut: boolean;
};

/** Keys that only touch the figure. */
type TouchEntry = Entry & {
  readonly kind: "touch";
  readonly keys: readonly string[];
};

type KeyEntry = SweepEntry | StepEntry | PickEntry | TouchEntry;

/** A key's entry, and the key's index in the entry's keys. */
export type Hit = { readonly entry: KeyEntry; readonly index: number };

/** Marks a table defineScheme checked. Only this module can write it. */
const checked: unique symbol = Symbol("checked");

/** One table: every key a scheme plays, once. Only defineScheme makes one. */
export type KeyScheme = {
  readonly entries: readonly KeyEntry[];
  /** Each key's entry, by its name or its lowercase letter. */
  readonly byKey: ReadonlyMap<string, Hit>;
  readonly [checked]: true;
};

/** A held sweep, from its press. */
export type Held = {
  readonly code: string;
  readonly id: ControlId;
  /** Signed nudges a second at full speed, with the key's direction and Shift. */
  readonly perSecond: number;
  /** When it starts to sweep: TAP_MS after its press, as its tap lands. */
  readonly since: number;
};

/**
 * The visitor's play over the config, as a value. Times are
 * DOMHighResTimeStamps, the clock that rAF timestamps and
 * KeyboardEvent.timeStamp share, so the runtime writes it from events and
 * the engine reads it at frame times.
 */
export type Play = {
  /** Where every press so far lands, without the sweeps still held. */
  readonly to: WaveformConfig;
  /** What showed, without held sweeps, when the glide to `to` began. A free Y keeps the pitch that showed, since a held X sweep moves a free Y only as drawnAt draws a glide. */
  readonly from: WaveformConfig;
  /** When the glide began. */
  readonly since: number;
  /** The glide's length. 0 under reduced motion. */
  readonly ms: number;
  /** Applied over the glide, in press order. */
  readonly held: readonly Held[];
  /**
   * When the tones start together again, or null. A cut still to come
   * always sits at the end of the current glide, `since + ms`, so the tones
   * never start again while Y is still moving.
   */
  readonly cutAt: number | null;
};

/** What a key event says, read from the DOM by the runtime. */
export type KeyInput = {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly isComposing: boolean;
  /** Another handler took the key. */
  readonly defaultPrevented: boolean;
  /** What holds focus: the page or the stage itself, a field that takes text, or another control. */
  readonly focus: "page" | "text" | "control";
  /** A modal dialog is open. */
  readonly modal: boolean;
};

/** Escape and ? belong to the runtime, and Tab to the page, so focus can always move on. defineScheme rejects them. */
export const HOME_KEY = "Escape";

export const GUIDE_KEY = "?";

const RESERVED: readonly string[] = [HOME_KEY, GUIDE_KEY, "Tab"];

/** A sweep key's press glides its tap over this long, and a held sweep starts as it lands. */
export const TAP_MS = 160;

/** A held sweep reaches full speed this long after it starts. */
export const RAMP_MS = 120;

/** A lifted sweep eases to a stop over this long, from the speed it had. */
export const COAST_MS = 160;

/** Shift multiplies a sweep's speed by this. */
export const FAST = 4;

/** A press touches the figure this hard unless its entry says otherwise. A strike is 0.9. */
const PRESS_TOUCH = 0.25;

const MAX_TOUCH = 0.9;

/** Escape glides home over two of a form's moves. */
const HOME_MS = 2 * MOVE_MS;

/** Keys a focused control uses itself, so the play leaves them to it. */
const CONTROL_KEYS = new Set([
  " ",
  "Enter",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
]);

/** A cubic ease-out. Its slope at the start is EASE_START, which sets a coast's length. */
const ease = (k: number) => 1 - (1 - k) ** 3;

const EASE_START = 3;

export function sweep(
  keys: readonly [down: string, up: string],
  id: ControlId,
  rate: { readonly tap: number; readonly perSecond: number },
  text: KeyText
): SweepEntry {
  return { kind: "sweep", keys, id, ...rate, touch: PRESS_TOUCH, ...text };
}

export function step(
  keys: readonly [down: string, up: string],
  id: ControlId,
  text: KeyText
): StepEntry {
  return { kind: "step", keys, id, touch: PRESS_TOUCH, ...text };
}

/** Glides over MOVE_MS and never cuts unless told otherwise. */
export function pick(
  keys: readonly string[],
  edit: PickEntry["edit"],
  text: KeyText,
  options: {
    readonly glideMs?: number;
    readonly cut?: boolean;
    readonly touch?: number;
  } = {}
): PickEntry {
  return {
    kind: "pick",
    keys,
    edit,
    glideMs: options.glideMs ?? MOVE_MS,
    cut: options.cut ?? false,
    touch: options.touch ?? PRESS_TOUCH,
    ...text,
  };
}

export function touch(
  keys: readonly string[],
  punch: number,
  text: KeyText
): TouchEntry {
  return { kind: "touch", keys, touch: punch, ...text };
}

/** A key's name in a scheme's lookup: a single letter in lowercase, anything else as is. */
const nameOf = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

/**
 * Checks a table and indexes its keys. Throws on the first problem, so a bad
 * table fails when it loads: a key listed twice, a reserved key, a touch
 * outside 0 to 0.9, a sweep of anything but a number control outside the
 * display, whose new settings would reset the scope's trace every frame, or
 * a sweep of a control with a need no write can meet, which the key could
 * never move.
 */
export function defineScheme(entries: readonly KeyEntry[]): KeyScheme {
  const byKey = new Map<string, Hit>();

  for (const entry of entries) {
    if (!(entry.touch >= 0 && entry.touch <= MAX_TOUCH))
      throw new Error(
        `"${entry.label}" touches by ${entry.touch}, outside 0 to ${MAX_TOUCH}.`
      );

    if (entry.kind === "sweep") {
      const control = CONTROLS[entry.id];

      if (control.kind !== "number" || control.group === "display")
        throw new Error(
          `"${entry.label}" sweeps ${entry.id}, which isn't a number control outside the display.`
        );

      if (control.needs?.some((need) => !need.meet))
        throw new Error(
          `"${entry.label}" sweeps ${entry.id}, which has a need no write can meet.`
        );
    }

    entry.keys.forEach((key, index) => {
      const name = nameOf(key);

      if (RESERVED.includes(name))
        throw new Error(`${key} is reserved for the runtime.`);

      if (byKey.has(name)) throw new Error(`${key} is listed twice.`);

      byKey.set(name, { entry, index });
    });
  }

  return { entries, byKey, [checked]: true };
}

/**
 * The notes on Ableton Live's computer keyboard, each a just interval over
 * X. The home row holds the white keys, and the row above the black ones.
 */
const NOTES = [
  ["KeyA", 1],
  ["KeyS", 9 / 8],
  ["KeyD", 5 / 4],
  ["KeyF", 4 / 3],
  ["KeyG", 3 / 2],
  ["KeyH", 5 / 3],
  ["KeyJ", 15 / 8],
  ["KeyK", 2],
  ["KeyW", 16 / 15],
  ["KeyE", 6 / 5],
  ["KeyT", 45 / 32],
  ["KeyY", 8 / 5],
  ["KeyU", 9 / 5],
] as const;

/** Y free at `hz`, with both tones in tune, so a just interval closes. */
function freeY(config: WaveformConfig, hz: number): WaveformConfig {
  const { tones } = config;

  return {
    ...config,
    tones: {
      ...tones,
      x: { ...tones.x, detuneCents: 0 },
      y: { ...tones.y, detuneCents: 0 },
      ratio: "free",
      yHz: hz,
    },
  };
}

/**
 * Y at `interval` over X, or the nearest octave of it inside Y's free range.
 * Notes always start from unison. An octave read back from the config can't
 * tell K, the octave, from A an octave up, so the next J would jump.
 */
function note(
  config: WaveformConfig,
  heard: WaveformConfig,
  interval: number
): WaveformConfig {
  const base = heard.tones.x.hz * interval;
  const lowest = Math.ceil(Math.log2(HZ_RANGE.min / base));
  const highest = Math.floor(Math.log2(HZ_RANGE.max / base));

  return freeY(config, base * 2 ** Math.min(highest, Math.max(lowest, 0)));
}

/** Notes glide 90 ms and cut as they land, so the figure closes. */
const NOTE = { glideMs: 90, cut: true, touch: 0.5 } as const;

/** The ten presets the number keys pick, 1 to 9 and 0. */
const KEYED_PRESETS = PRESET_ORDER.slice(0, 10);

/** The block's keys, by code, so Shift keeps each key's entry and the notes keep their places on any layout. */
export const WAVEFORM_KEYS = defineScheme([
  pick(
    NOTES.map(([code]) => code),
    (config, index, _shift, heard) => note(config, heard, NOTES[index][1]),
    COPY.notes,
    NOTE
  ),
  // A whole tone a tap, and an octave a second, as for X.
  sweep(["KeyZ", "KeyX"], "tones.yHz", { tap: 2, perSecond: 12 }, COPY.yHz),
  // A whole tone a tap, and an octave a second.
  sweep(["KeyC", "KeyV"], "tones.x.hz", { tap: 2, perSecond: 12 }, COPY.xHz),
  pick(
    ["KeyN", "KeyM"],
    (config, index) =>
      nudgeControl(config, "tones.ratio", index === 0 ? -1 : 1),
    COPY.ratio,
    { cut: true }
  ),
  // 15° a tap, and a quarter turn a second.
  sweep(
    ["ArrowLeft", "ArrowRight"],
    "motion.rotation",
    { tap: 3, perSecond: 18 },
    COPY.turn
  ),
  // 30° a tap, and 60° a second.
  sweep(
    ["ArrowDown", "ArrowUp"],
    "tones.y.phase",
    { tap: 6, perSecond: 12 },
    COPY.phase
  ),
  step(["Comma", "Period"], "tones.y.wave", COPY.wave),
  step(["Semicolon", "Quote"], "motion.symmetry", COPY.copies),
  // 0.1 Hz a tap, and 0.2 Hz a second.
  sweep(
    ["BracketLeft", "BracketRight"],
    "motion.drift",
    { tap: 10, perSecond: 20 },
    COPY.drift
  ),
  // A tenth of the frame a tap, and 0.3 a second. The trail stays the
  // panel's: a still figure looks the same at any trail.
  sweep(
    ["Minus", "Equal"],
    "forms.stage.size",
    { tap: 2, perSecond: 6 },
    COPY.size
  ),
  pick(
    KEYED_PRESETS.map((_, index) => `Digit${(index + 1) % 10}`),
    (config, index) => applyPreset(config, KEYED_PRESETS[index]),
    COPY.presets,
    { cut: true }
  ),
  touch(["Space"], 0.9, COPY.strike),
]);

/** Whether the play leaves this key alone. */
export function standsDown(input: KeyInput): boolean {
  return (
    input.ctrlKey ||
    input.metaKey ||
    input.altKey ||
    input.isComposing ||
    input.key === "Process" ||
    input.defaultPrevented ||
    input.modal ||
    input.focus === "text" ||
    (input.focus === "control" && CONTROL_KEYS.has(input.key))
  );
}

/** The entry a key plays: by its code first, then by its key, a single letter in either case. */
export function entryFor(
  scheme: KeyScheme,
  input: Pick<KeyInput, "key" | "code">
): Hit | null {
  return (
    scheme.byKey.get(input.code) ?? scheme.byKey.get(nameOf(input.key)) ?? null
  );
}

/** The guide's rows: one per entry, then Escape and ?. */
export function guideOf(scheme: KeyScheme): readonly KeyText[] {
  return [
    ...scheme.entries.map(({ label, does }) => ({ label, does })),
    COPY.home,
    COPY.help,
  ];
}

/** Each punctuation code's key on a US layout. */
const CODE_KEYS = new Map([
  ["Space", "Space"],
  ["Comma", ","],
  ["Period", "."],
  ["Slash", "/"],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["Minus", "-"],
  ["Equal", "="],
  ["Backquote", "`"],
  ["Backslash", "\\"],
]);

function shortcutOf(key: string): string {
  if (key === " ") return "Space";

  const letter = /^Key([A-Z])$/.exec(key)?.[1];
  const digit = /^Digit(\d)$/.exec(key)?.[1];

  return letter?.toLowerCase() ?? digit ?? CODE_KEYS.get(key) ?? key;
}

/** The stage's aria-keyshortcuts: every key the scheme plays, then Escape and ?. */
export function shortcutsOf(scheme: KeyScheme): string {
  return [...scheme.entries.flatMap((entry) => entry.keys), HOME_KEY, GUIDE_KEY]
    .map(shortcutOf)
    .join(" ");
}

/** A play at rest on `config`. */
export function startPlay(config: WaveformConfig, at: number): Play {
  return { to: config, from: config, since: at, ms: 0, held: [], cutAt: null };
}

/** Nudges a held sweep has moved by `now`, gathering speed over RAMP_MS. */
function travelOf(held: Held, now: number): number {
  const ms = Math.max(0, now - held.since);

  const full = ms < RAMP_MS ? (ms * ms) / (2 * RAMP_MS) : ms - RAMP_MS / 2;

  return (held.perSecond * full) / 1000;
}

/** A held sweep's nudges a second at `now`. */
function speedOf(held: Held, now: number): number {
  return held.perSecond * Math.min(1, Math.max(0, now - held.since) / RAMP_MS);
}

const sweptTo = (config: WaveformConfig, held: Held, now: number) =>
  nudgeControl(config, held.id, travelOf(held, now));

/** Number controls a glide moves: every one but the display's, whose new settings reset the scope's trace, and Y's frequency, which moves as a pitch. */
const GLIDING: readonly NumberControl[] = CONTROL_IDS.flatMap((id) => {
  const control = CONTROLS[id];

  return control.kind === "number" &&
    control.group !== "display" &&
    id !== "tones.yHz"
    ? [control]
    : [];
});

/** `k` of the way from `a` to `b` on the control's scale: by ratio, the short way round, or straight. */
function between(control: NumberControl, a: number, b: number, k: number) {
  if (control.scale === "log") return a * (b / a) ** k;

  if (control.scale === "linear") return a + (b - a) * k;

  const span = control.max - control.min;
  const turn = ((((b - a) % span) + 1.5 * span) % span) - span / 2;

  return a + turn * k;
}

/**
 * `from` eased toward `to`, `k` of the way. It starts from `to`, so every
 * choice, switch, the source, and the whole display are `to`'s at once and
 * display.xy and display.yt keep their identity. Y moves as a pitch: when
 * its frequency differs, the glide draws ratio Free at the geometric mix of
 * the two and lands on `to`'s ratio. Symmetry rounds in its own set(), so
 * copies change halfway.
 */
function glide(
  from: WaveformConfig,
  to: WaveformConfig,
  k: number
): WaveformConfig {
  let drawn = to;

  for (const control of GLIDING) {
    const a = control.read(from);
    const b = control.read(to);

    if (a !== b) drawn = writeNumber(drawn, control, between(control, a, b, k));
  }

  const fromHz = yHzOf(from.tones);
  const toHz = yHzOf(to.tones);

  if (fromHz === toHz) return drawn;

  return {
    ...drawn,
    tones: {
      ...drawn.tones,
      ratio: "free",
      yHz: fromHz * (toHz / fromHz) ** k,
    },
  };
}

/** The glide alone at `now`, without held sweeps. `to` itself once it lands. */
function glideAt(play: Play, now: number): WaveformConfig {
  const k = play.ms === 0 ? 1 : (now - play.since) / play.ms;

  return k >= 1 ? play.to : glide(play.from, play.to, ease(Math.max(0, k)));
}

/**
 * The play with its glide started again at `at`, over `ms`. Every change
 * that starts the glide again comes through here, so the cut stays with the
 * landing. A cut still to come moves to the new landing, and `cut` puts one
 * there. A cut already due stays as it is, so the engine, which makes each
 * cut once, still makes it if no frame has drawn since.
 */
function restart(
  play: Play,
  next: Pick<Play, "to" | "from" | "held">,
  at: number,
  ms: number,
  cut: boolean
): Play {
  const pending = play.cutAt !== null && at < play.cutAt;

  return {
    ...next,
    since: at,
    ms,
    cutAt: cut || pending ? at + ms : play.cutAt,
  };
}

/**
 * `from` with Y at the pitch that shows at `at`, for a play whose held
 * sweeps are `held`. Mid-glide, Y passes through Free at a pitch of its
 * own, and a held X sweep moves that pitch as drawnAt draws it. Folding
 * sweeps into a free Y leaves it alone, so without this a lift or a press
 * during the glide would jump Y. A Y sweep in `held` still adds its travel
 * on top of `from` as drawnAt draws it, so its travel so far comes out
 * here, or it would count twice.
 */
function withShownY(
  from: WaveformConfig,
  play: Play,
  held: readonly Held[],
  at: number
): WaveformConfig {
  if (from.tones.ratio !== "free") return from;

  let yHz = yHzOf(drawnAt(play, at).tones);

  for (const item of held)
    if (item.id === "tones.yHz") yHz /= Y_HZ.nudge ** travelOf(item, at);

  return yHz === from.tones.yHz
    ? from
    : { ...from, tones: { ...from.tones, yHz } };
}

/** A glide from what shows at `at` to `to`. */
function glideTo(
  play: Play,
  to: WaveformConfig,
  at: number,
  ms: number,
  cut: boolean
): Play {
  return restart(
    play,
    {
      to,
      from: withShownY(glideAt(play, at), play, play.held, at),
      held: play.held,
    },
    at,
    ms,
    cut
  );
}

/**
 * The play after a key of `hit` goes down. The same object when the press
 * changes nothing: a repeat or a second press of a held sweep, a repeat of
 * a pick, a step at its limit, a pick whose edit declines, and
 * every touch, which the runtime gives to the engine.
 */
export function press(
  play: Play,
  hit: Hit,
  input: Pick<KeyInput, "code" | "shiftKey" | "repeat">,
  at: number,
  reduced: boolean
): Play {
  const { entry, index } = hit;
  const direction = index === 0 ? -1 : 1;

  switch (entry.kind) {
    case "sweep": {
      if (input.repeat || play.held.some((held) => held.code === input.code))
        return play;

      const scale = direction * (input.shiftKey ? FAST : 1);

      // A need the key meets first, such as Free for Y's frequency under a
      // ratio, starts the control where it sounds at the press, as drawnAt
      // draws it, so neither a held X sweep nor a glide still in flight lets
      // Y fall back to the landing's pitch. defineScheme keeps sweeps on
      // number controls.
      const control = CONTROLS[entry.id];
      const met = meetNeeds(play.to, entry.id);

      const start =
        met === play.to || control.kind !== "number"
          ? met
          : writeNumber(
              met,
              control,
              control.read(meetNeeds(drawnAt(play, at), entry.id))
            );

      const to = nudgeControl(start, entry.id, scale * entry.tap);

      const tapped =
        to === play.to
          ? play
          : glideTo(play, to, at, reduced ? 0 : TAP_MS, false);

      if (reduced) return tapped;

      const held: Held = {
        code: input.code,
        id: entry.id,
        perSecond: scale * entry.perSecond,
        since: at + TAP_MS,
      };

      return { ...tapped, held: [...tapped.held, held] };
    }

    case "step": {
      if (reduced && input.repeat) return play;

      const to = nudgeControl(play.to, entry.id, direction);

      return to === play.to
        ? play
        : glideTo(play, to, at, reduced ? 0 : MOVE_MS, false);
    }

    case "pick": {
      if (input.repeat) return play;

      const heard = sweptAll(play.to, play.held, at);
      const to = entry.edit(play.to, index, input.shiftKey, heard);

      if (to === play.to) return play;

      const ms = reduced ? 0 : entry.glideMs;

      // A pick that writes a held sweep's control takes it over: the glide
      // starts from where the sweep got to and lands on the pick exactly,
      // and the sweep starts again from the landing with a fresh ramp. It
      // writes the control when, played over what sounds, it moves it. That
      // catches a note that lands where the sweep's tap did, which `to`
      // alone can't tell from a control the pick leaves as it was, and it
      // leaves a held X sweeping under a note.
      const over = entry.edit(heard, index, input.shiftKey, heard);

      const taken = play.held.filter(
        (held) => CONTROLS[held.id].read(over) !== CONTROLS[held.id].read(heard)
      );

      if (taken.length === 0) return glideTo(play, to, at, ms, entry.cut);

      const shows = taken.reduce(
        (config, held) => sweptTo(config, held, at),
        glideAt(play, at)
      );

      const held = play.held.map((item) =>
        taken.includes(item)
          ? { ...item, since: Math.max(item.since, at + ms) }
          : item
      );

      return restart(
        play,
        { to, from: withShownY(shows, play, held, at), held },
        at,
        ms,
        entry.cut
      );
    }

    case "touch":
      return play;
  }
}

/**
 * Folds the sweep held on `code` into the play where it got to, plus a
 * coast that eases to a stop over COAST_MS from the speed it had. What
 * shows at `at` doesn't move. The same object when nothing is held there.
 * A lift before the sweep starts only lets go of the key, so its tap glides
 * on as it was.
 *
 * Every other sweep held on the same control folds in too, in press order,
 * and starts again from `at`, or later if it hasn't started yet. Each sweep
 * clamps at the control's limits, so folding one alone would reorder the
 * clamps, and holding [ and ] together at the top of the drift would jump
 * on the first lift.
 */
export function release(play: Play, code: string, at: number): Play {
  const held = play.held.find((item) => item.code === code);

  if (!held) return play;

  if (at <= held.since)
    return { ...play, held: play.held.filter((item) => item !== held) };

  const coast = (speedOf(held, at) * COAST_MS) / 1000 / EASE_START;

  const fold = (config: WaveformConfig) =>
    play.held.reduce(
      (next, item) => (item.id === held.id ? sweptTo(next, item, at) : next),
      config
    );

  const still = play.held.flatMap((item) =>
    item === held
      ? []
      : item.id === held.id
        ? [{ ...item, since: Math.max(item.since, at) }]
        : [item]
  );

  return restart(
    play,
    {
      to: nudgeControl(fold(play.to), held.id, coast),
      from: withShownY(fold(glideAt(play, at)), play, still, at),
      held: still,
    },
    at,
    COAST_MS,
    false
  );
}

/** Every held sweep released at `at`, for a lost keyup: a window blur, a hidden page, or an unmount. */
export function releaseAll(play: Play, at: number): Play {
  let next = play;

  for (const held of play.held) next = release(next, held.code, at);

  return next;
}

/**
 * Escape: held sweeps end where they got to, and the figure glides from
 * what shows to `home` over two of a form's moves and cuts as it lands, so
 * a closed figure draws its own shape. Instant under reduced motion.
 */
export function goHome(
  play: Play,
  home: WaveformConfig,
  at: number,
  reduced: boolean
): Play {
  return restart(
    play,
    { to: home, from: drawnAt(play, at), held: [] },
    at,
    reduced ? 0 : HOME_MS,
    true
  );
}

/**
 * What live forms draw at `now`: the glide, then each held sweep. `to`
 * itself once the glide has landed and nothing is held, so a settled play
 * costs the engine nothing per frame.
 */
export function drawnAt(play: Play, now: number): WaveformConfig {
  if (play.held.length === 0) return glideAt(play, now);

  // The sweeps move both ends, so a glide of Y's pitch through Free starts
  // and lands on the swept Y, and a held X sweep never jumps a locked Y.
  return glideAt(
    {
      ...play,
      from: sweptAll(play.from, play.held, now),
      to: sweptAll(play.to, play.held, now),
    },
    now
  );
}

/** `config` with every held sweep where it is at `now`, in press order. */
function sweptAll(
  config: WaveformConfig,
  held: readonly Held[],
  now: number
): WaveformConfig {
  let swept = config;

  for (const item of held) swept = sweptTo(swept, item, now);

  return swept;
}

/** Whether the play has landed with nothing held, so drawnAt draws `to` from now on. */
function restsAt(play: Play, now: number): boolean {
  return play.held.length === 0 && now >= play.since + play.ms;
}

/** Y's frequency, which GLIDING leaves out to move it as a pitch. Checked as the module loads. */
const Y_HZ = (() => {
  const control = CONTROLS["tones.yHz"];

  if (control.kind !== "number")
    throw new Error("tones.yHz isn't a number control.");

  return control;
})();

/**
 * What the page holds at `now`. Once the play rests, `play.to` itself.
 * While it moves, `to` with every gliding number as drawnAt draws it, and
 * Y's frequency as the pitch that sounds while `to` frees Y. Choices,
 * switches, the source, and the display stay as `to` lands them, so a ratio
 * glide that draws through Free never shows Free. `last` back when every
 * control reads as it does there, so a frame that shows nothing new
 * commits nothing.
 */
export function shownAt(
  play: Play,
  now: number,
  last: WaveformConfig
): WaveformConfig {
  if (restsAt(play, now)) return play.to;

  const drawn = drawnAt(play, now);
  let shown = play.to;

  for (const control of GLIDING)
    shown = writeNumber(shown, control, control.read(drawn));

  if (play.to.tones.ratio === "free")
    shown = writeNumber(shown, Y_HZ, yHzOf(drawn.tones));

  return CONTROL_IDS.every(
    (id) => CONTROLS[id].read(shown) === CONTROLS[id].read(last)
  )
    ? last
    : shown;
}

/** The frames the player commits on: rAF in the browser, a manual clock in tests. Times share KeyboardEvent.timeStamp's clock. */
export type Frames = {
  request(tick: (now: number) => void): number;
  cancel(id: number): void;
};

/** What the page passes the provider. */
type Page = {
  readonly config: WaveformConfig;
  readonly audio: SampleFeed | null;
};

/** What the player drives: the engine's set and touch. */
export type PlaySink = {
  set(next: Page & { readonly play: Play | null }): void;
  touch(punch: number): void;
};

/**
 * The provider's keys: the one writer of the play. It hands each play to
 * the sink and commits what the play shows through onConfigChange, by
 * shownAt: at each press, lift, and Escape, and on every frame while the
 * play moves. It remembers its own commits, so the config they come back as
 * keeps the play going.
 */
export type Player = {
  /** The page's config, audio, and handler. A config the keys didn't make ends the play and becomes home. */
  sync(
    page: Page & {
      readonly onConfigChange: ((config: WaveformConfig) => void) | null;
    }
  ): void;
  keyDown(hit: Hit, input: KeyInput, at: number, reduced: boolean): void;
  keyUp(code: string, at: number): void;
  /** Every held key comes up, for a keyup the page never sees. */
  letGo(at: number): void;
  /** Escape. False when the figure already lands on home, so the key stays the page's. */
  home(at: number, reduced: boolean): boolean;
  /**
   * Ends the play, cancels a pending frame, and drops the handler until the
   * next sync. The provider calls it on unmount, before Stage's cleanup lets
   * go of the keys, so that late letGo does nothing. It doesn't end the
   * player, since Strict Mode's effect replay disposes and then syncs the
   * same one.
   */
  dispose(): void;
};

export function createPlayer(
  sink: PlaySink,
  initial: WaveformConfig,
  frames: Frames
): Player {
  let play: Play | null = null;
  let page: Page = { config: initial, audio: null };
  let home = initial;
  /** The config the page has, or was last sent. */
  let sent = initial;
  let commit: ((config: WaveformConfig) => void) | null = null;
  let frame: number | null = null;
  const own = new WeakSet<WaveformConfig>();

  /** Commits what the play shows at `now`, when it shows something new. */
  function commitAt(now: number) {
    if (!play || !commit) return;
    const next = shownAt(play, now, sent);

    if (next === sent) return;
    sent = next;
    own.add(next);
    commit(next);
  }

  /** Commits each frame until the play rests, ends, or loses its handler. */
  function tick(now: number) {
    frame = null;
    commitAt(now);

    if (play && commit && !restsAt(play, now)) frame = frames.request(tick);
  }

  function push(next: Play, at: number) {
    if (next === play) return;
    play = next;
    sink.set({ ...page, play });
    commitAt(at);

    if (commit && frame === null && !restsAt(next, at))
      frame = frames.request(tick);
  }

  return {
    sync(next) {
      commit = next.onConfigChange;

      if (next.config !== page.config) {
        sent = next.config;

        if (!own.has(next.config)) {
          play = null;
          home = next.config;
        }
      }

      page = { config: next.config, audio: next.audio };
      sink.set({ ...page, play });
    },
    keyDown(hit, input, at, reduced) {
      if (!input.repeat && hit.entry.touch > 0) sink.touch(hit.entry.touch);

      const base = play ?? startPlay(page.config, at);
      const next = press(base, hit, input, at, reduced);

      if (next !== base) push(next, at);
    },
    keyUp(code, at) {
      if (play) push(release(play, code, at), at);
    },
    letGo(at) {
      if (play) push(releaseAll(play, at), at);
    },
    home(at, reduced) {
      if (!play || (play.to === home && play.held.length === 0)) return false;
      push(goHome(play, home, at, reduced), at);

      return true;
    },
    dispose() {
      if (frame !== null) frames.cancel(frame);
      frame = null;
      play = null;
      commit = null;
    },
  };
}

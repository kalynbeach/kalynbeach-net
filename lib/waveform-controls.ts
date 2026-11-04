/**
 * Home's waveform controls: the ghost "?" under the stage and the key map at
 * the top of the rail (Layout E, "Waveform controls: states, timings,
 * motion"). This module is the pure half: the rows, read from the installed
 * block's key table, and one state machine with the timers each state runs.
 * components/site/waveform-controls.tsx feeds it events and draws it.
 */
import {
  COPY,
  HOME_KEY,
  WAVEFORM_KEYS,
  entryFor,
  type Hit,
} from "@/components/waveform/keys";
import {
  CONTROLS,
  PRESETS,
  activePreset,
  type ControlId,
  type WaveformConfig,
} from "@/components/waveform/settings";

type Entry = Hit["entry"];

/** One key cap: the text it shows and the keys (KeyboardEvent.code) it stands for. */
export type Cap = { readonly text: string; readonly keys: readonly string[] };

/** One row of the map. Only Escape's row has no entry: the block reserves the key. */
export type Row = {
  readonly label: string;
  readonly caps: readonly Cap[];
  readonly entry: Entry | null;
  /** What the row's controls show in `config`, or null for a row with no value, like Strike. */
  readonly value: ((config: WaveformConfig) => string) | null;
};

/** Placeholder copy. D2's labels, which Kalyn kept for now; other rows take the block's own draft copy. */
const LABELS = new Map<string, string>([
  [COPY.notes.does, "Notes"],
  [COPY.yHz.does, "Y freq"],
  [COPY.xHz.does, "X freq"],
  [COPY.ratio.does, "Ratio"],
  [COPY.presets.does, "Presets"],
]);

const SAVED_LOOK = "Saved look";

/** The control's value as the dashboard's panel shows it. */
function reading(id: ControlId): Row["value"] {
  const control = CONTROLS[id];

  switch (control.kind) {
    case "number":
      return (config) => control.format(control.read(config));
    case "choice":
      return (config) => {
        const value = control.read(config);

        return (
          control.options.find((option) => option.value === value)?.label ??
          String(value)
        );
      };
    case "switch":
      return null;
  }
}

/** The preset the figure draws, by name. HDR controls never decide a preset, so the display is moot. */
const preset: Row["value"] = (config) => {
  const id = activePreset(config, { hdrDisplay: false });

  return id ? PRESETS[id].label : "";
};

/** Picks name no control, so each one the map shows names its reading here. */
const PICK_READINGS = new Map<string, Row["value"]>([
  [COPY.notes.does, reading("tones.yHz")],
  [COPY.ratio.does, reading("tones.ratio")],
  [COPY.presets.does, preset],
]);

const ARROWS: Readonly<Record<string, string>> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

const PUNCTUATION: Readonly<Record<string, string>> = {
  Comma: ",",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Space: "Space",
};

/** A key code's text on a US layout: KeyM is M, Digit1 is 1. */
export function keyText(code: string): string {
  return (
    /^(?:Key|Digit)(.)$/.exec(code)?.[1] ??
    ARROWS[code] ??
    PUNCTUATION[code] ??
    code
  );
}

/** The board's rows, so a run of keys on one row reads first to last: A–K, 1–0. */
const BOARD = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

/**
 * Two keys take a cap each. A longer run takes one cap per board row, named
 * by its first and last key along that row, so the notes read A–K and W–U.
 */
function capsOf(keys: readonly string[]): readonly Cap[] {
  if (keys.length <= 2)
    return keys.map((key) => ({ text: keyText(key), keys: [key] }));

  const rows = new Map<number, string[]>();

  for (const key of keys) {
    const row = BOARD.findIndex((line) => line.includes(keyText(key)));
    rows.set(row, [...(rows.get(row) ?? []), key]);
  }

  return [...rows].map(([row, run]) => {
    const texts = run.map(keyText);
    const line = BOARD[row] ?? "";
    const along = (text: string) => line.indexOf(text);
    const first = texts.reduce((a, b) => (along(b) < along(a) ? b : a));
    const last = texts.reduce((a, b) => (along(b) > along(a) ? b : a));

    return { text: first === last ? first : `${first}–${last}`, keys: run };
  });
}

function rowOf(entry: Entry): Row {
  const value =
    entry.kind === "sweep" || entry.kind === "step"
      ? reading(entry.id)
      : (PICK_READINGS.get(entry.does) ?? null);

  return {
    label: LABELS.get(entry.does) ?? entry.does,
    caps: capsOf(entry.keys),
    entry,
    value,
  };
}

/** Every entry in the block's table, in its order, then Escape's row. */
export const CONTROL_ROWS: readonly Row[] = [
  ...WAVEFORM_KEYS.entries.map(rowOf),
  {
    label: SAVED_LOOK,
    caps: [{ text: "Esc", keys: [HOME_KEY] }],
    entry: null,
    value: null,
  },
];

/** Where a key the block plays sits on the map: its row and its cap. */
export type Spot = { readonly row: number; readonly cap: number };

/** The row and cap for a key, or null when the block's table doesn't map it. */
export function spotOf(input: {
  readonly key: string;
  readonly code: string;
}): Spot | null {
  const hit = entryFor(WAVEFORM_KEYS, input);

  if (!hit) return null;
  const row = CONTROL_ROWS.findIndex(({ entry }) => entry === hit.entry);
  const key = hit.entry.keys[hit.index];
  const cap = CONTROL_ROWS[row].caps.findIndex(({ keys }) =>
    keys.includes(key)
  );

  return { row, cap };
}

/** Where the pointer is. "stage" spans the stage box, the gap under it and the ghost. */
export type Pointer = "stage" | "rail" | "away";

/** A key the block played that is still down: its cap, and the code its keyup carries. */
export type Held = Spot & { readonly code: string };

/** The key just pressed: its row and cap, its value fresh until it settles once the key is up. */
export type Mark = Spot & {
  /** KeyboardEvent.code, which its keyup carries. */
  readonly code: string;
  readonly fresh: boolean;
  /** The press's number, so a settle meant for an earlier press does nothing. */
  readonly press: number;
};

/**
 * What shows. rest: nothing. ghost: the "?" under the stage. closing: the
 * "?" still, with the pointer gone, until it fades. open: the controls in
 * the rail and the "?" turned on, until closed. Only the "?", or the ? key
 * as its shortcut, opens them; a key the block plays marks its row while
 * they are open and otherwise just plays.
 */
export type Panel =
  | { readonly kind: "rest" }
  | { readonly kind: "ghost" }
  | { readonly kind: "closing" }
  | { readonly kind: "open"; readonly mark: Mark | null };

export type ControlsState = {
  readonly panel: Panel;
  readonly pointer: Pointer;
  readonly ghostFocused: boolean;
  /** Presses so far, for each mark's number. */
  readonly presses: number;
  /**
   * Every key the block played that is still down. The mark names only the
   * latest, so a sweep held under another key's press keeps its own cap
   * pressed here. Kept while closed too, so controls opened mid-sweep show
   * the held cap.
   */
  readonly held: readonly Held[];
};

export type ControlsEvent =
  /** The pointer entered or left the stage zone or the rail. */
  | { readonly type: "pointer"; readonly to: Pointer }
  /** The pointer rested on the stage for DWELL_MS. */
  | { readonly type: "dwell" }
  | { readonly type: "ghostFocus"; readonly focused: boolean }
  /** A click or Enter on the ghost, or ? anywhere on Home. */
  | { readonly type: "toggle" }
  /** A key the block played. */
  | { readonly type: "press"; readonly spot: Spot; readonly code: string }
  /** A key came up. Without a code, every key did, as on a window blur. */
  | { readonly type: "lift"; readonly code?: string }
  /** A mark's value has shown for VALUE_MS since its key came up. */
  | { readonly type: "settle"; readonly press: number }
  /** × or Escape. */
  | { readonly type: "close" }
  /** The ghost's GHOST_LINGER_MS ran out. */
  | { readonly type: "fade" }
  /** The visitor left Home, or the window left the desktop layout. */
  | { readonly type: "leave" };

/** E's timings. */
export const DWELL_MS = 1000;
export const GHOST_LINGER_MS = 400;
export const VALUE_MS = 1500;

export const INITIAL_CONTROLS: ControlsState = {
  panel: { kind: "rest" },
  pointer: "away",
  ghostFocused: false,
  presses: 0,
  held: [],
};

/** Closed: the ghost stays while the pointer is over it or it has focus, and otherwise lingers. */
function closed(state: ControlsState): ControlsState {
  const kind =
    state.pointer === "stage" || state.ghostFocused ? "ghost" : "closing";

  return { ...state, panel: { kind } };
}

function withMark(
  state: ControlsState,
  update: (mark: Mark) => Mark
): ControlsState {
  const { panel } = state;

  if (panel.kind !== "open" || !panel.mark) return state;
  const mark = update(panel.mark);

  return mark === panel.mark ? state : { ...state, panel: { ...panel, mark } };
}

export function controlsReducer(
  state: ControlsState,
  event: ControlsEvent
): ControlsState {
  const { panel } = state;

  switch (event.type) {
    case "pointer": {
      if (event.to === state.pointer) return state;
      const next = { ...state, pointer: event.to };

      if (panel.kind === "closing" && event.to === "stage")
        return { ...next, panel: { kind: "ghost" } };

      if (panel.kind === "ghost" && event.to !== "stage" && !state.ghostFocused)
        return { ...next, panel: { kind: "closing" } };

      return next;
    }

    case "dwell":
      return panel.kind === "rest" && state.pointer === "stage"
        ? { ...state, panel: { kind: "ghost" } }
        : state;

    case "ghostFocus": {
      const next = { ...state, ghostFocused: event.focused };

      if (event.focused && (panel.kind === "rest" || panel.kind === "closing"))
        return { ...next, panel: { kind: "ghost" } };

      if (!event.focused && panel.kind === "ghost" && state.pointer !== "stage")
        return { ...next, panel: { kind: "closing" } };

      return next;
    }

    case "toggle":
      return panel.kind === "open"
        ? closed(state)
        : { ...state, panel: { kind: "open", mark: null } };

    case "press": {
      const press = state.presses + 1;
      const mark: Mark = {
        ...event.spot,
        code: event.code,
        fresh: true,
        press,
      };

      return {
        ...state,
        presses: press,
        held: [
          ...state.held.filter(({ code }) => code !== event.code),
          { ...event.spot, code: event.code },
        ],
        panel: panel.kind === "open" ? { ...panel, mark } : panel,
      };
    }

    case "lift": {
      const held = state.held.filter(
        ({ code }) => event.code !== undefined && code !== event.code
      );

      return held.length === state.held.length ? state : { ...state, held };
    }

    case "settle":
      return withMark(state, (mark) =>
        mark.press === event.press && mark.fresh
          ? { ...mark, fresh: false }
          : mark
      );

    case "close":
      return panel.kind === "open" ? closed(state) : state;

    case "fade":
      return panel.kind === "closing"
        ? { ...state, panel: { kind: "rest" } }
        : state;

    case "leave":
      return state === INITIAL_CONTROLS ? state : INITIAL_CONTROLS;
  }
}

/** A timer a state runs. Its id stays the same for as long as it should keep running. */
export type Due = {
  readonly id: string;
  readonly ms: number;
  readonly event: ControlsEvent;
};

/**
 * The timers `state` runs: the dwell before the ghost, the ghost's linger,
 * and a fresh value's hold, which starts once its own key comes up, so a
 * held sweep stays bright.
 */
export function dueTimers(state: ControlsState): readonly Due[] {
  const { panel } = state;
  const due: Due[] = [];

  if (panel.kind === "rest" && state.pointer === "stage")
    due.push({ id: "dwell", ms: DWELL_MS, event: { type: "dwell" } });

  if (panel.kind === "closing")
    due.push({ id: "fade", ms: GHOST_LINGER_MS, event: { type: "fade" } });

  if (panel.kind !== "open") return due;

  const { mark } = panel;

  if (mark?.fresh && !state.held.some(({ code }) => code === mark.code))
    due.push({
      id: `settle@${mark.press}`,
      ms: VALUE_MS,
      event: { type: "settle", press: mark.press },
    });

  return due;
}

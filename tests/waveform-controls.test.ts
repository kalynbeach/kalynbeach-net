import { describe, expect, test } from "vitest";
import { WAVEFORM_KEYS } from "@/components/waveform/keys";
import {
  DEFAULT_WAVEFORM_CONFIG,
  type WaveformConfig,
} from "@/components/waveform/settings";
import {
  CONTROL_ROWS,
  INITIAL_CONTROLS,
  controlsReducer,
  dueTimers,
  spotOf,
  type ControlsEvent,
  type ControlsState,
} from "@/lib/waveform-controls";

const run = (events: ControlsEvent[], from = INITIAL_CONTROLS) =>
  events.reduce(controlsReducer, from);

const kind = (state: ControlsState) => state.panel.kind;

const M = { key: "m", code: "KeyM" };
const pressM: ControlsEvent = { type: "press", spot: spotOf(M)!, code: "KeyM" };

const timers = (state: ControlsState) =>
  dueTimers(state).map(({ event, ms }) => [event.type, ms]);

describe("the map's rows", () => {
  const row = (label: string) => {
    const found = CONTROL_ROWS.find((r) => r.label === label);
    if (!found) throw new Error(`no row ${label}`);
    return found;
  };
  const caps = (label: string) => row(label).caps.map((cap) => cap.text);

  test("every key the block plays sits on exactly one cap", () => {
    for (const entry of WAVEFORM_KEYS.entries)
      for (const key of entry.keys) {
        const rows = CONTROL_ROWS.filter((r) => r.entry === entry);
        expect(rows).toHaveLength(1);
        expect(
          rows[0].caps.filter((cap) => cap.keys.includes(key))
        ).toHaveLength(1);
      }
  });

  test("D2's labels name their rows; Escape's row is the saved look", () => {
    expect(CONTROL_ROWS.map((r) => r.label)).toEqual(
      expect.arrayContaining(["Notes", "Y freq", "X freq", "Ratio", "Presets"])
    );
    expect(CONTROL_ROWS.at(-1)).toMatchObject({
      label: "Saved look",
      entry: null,
    });
    expect(caps("Saved look")).toEqual(["Esc"]);
  });

  test("caps read as the keyboard does", () => {
    expect(caps("Notes")).toEqual(["A–K", "W–U"]);
    expect(caps("Y freq")).toEqual(["Z", "X"]);
    expect(caps("X freq")).toEqual(["C", "V"]);
    expect(caps("Ratio")).toEqual(["N", "M"]);
    expect(caps("Presets")).toEqual(["1–0"]);
  });

  test("M marks the Ratio row's M cap", () => {
    const spot = spotOf(M)!;
    expect(CONTROL_ROWS[spot.row].label).toBe("Ratio");
    expect(CONTROL_ROWS[spot.row].caps[spot.cap].text).toBe("M");
  });

  test("a shifted key marks the same cap, and an unmapped key none", () => {
    expect(spotOf({ key: "M", code: "KeyM" })).toEqual(spotOf(M));
    expect(spotOf({ key: "1", code: "Digit1" })).toMatchObject({
      row: CONTROL_ROWS.findIndex((r) => r.label === "Presets"),
      cap: 0,
    });
    expect(spotOf({ key: "q", code: "KeyQ" })).toBeNull();
    expect(spotOf({ key: "?", code: "Slash" })).toBeNull();
  });

  test("values read the config the provider hands back", () => {
    const at = (tones: Partial<WaveformConfig["tones"]>): WaveformConfig => ({
      ...DEFAULT_WAVEFORM_CONFIG,
      tones: { ...DEFAULT_WAVEFORM_CONFIG.tones, ...tones },
    });
    expect(row("Ratio").value?.(at({ ratio: "5:4" }))).toBe("5:4");
    expect(row("Notes").value?.(at({ ratio: "free", yHz: 330 }))).toBe(
      "330.0 Hz"
    );
    expect(row("Presets").value?.(DEFAULT_WAVEFORM_CONFIG)).toBe("Golden");
    expect(row("Saved look").value).toBeNull();
  });
});

describe("the controls' states", () => {
  test("rest: the pointer resting on the stage brings the ghost after the dwell", () => {
    const resting = run([{ type: "pointer", to: "stage" }]);
    expect(kind(resting)).toBe("rest");
    expect(timers(resting)).toEqual([["dwell", 1000]]);
    expect(kind(run([{ type: "dwell" }], resting))).toBe("ghost");
  });

  test("rest: a dwell that lands after the pointer left does nothing", () => {
    const left = run([
      { type: "pointer", to: "stage" },
      { type: "pointer", to: "away" },
    ]);
    expect(timers(left)).toEqual([]);
    expect(kind(run([{ type: "dwell" }], left))).toBe("rest");
  });

  test("ghost: focus reaching the button shows it, and losing it lets it linger", () => {
    const focused = run([{ type: "ghostFocus", focused: true }]);
    expect(kind(focused)).toBe("ghost");
    const blurred = run([{ type: "ghostFocus", focused: false }], focused);
    expect(kind(blurred)).toBe("closing");
    expect(timers(blurred)).toEqual([["fade", 400]]);
    expect(kind(run([{ type: "fade" }], blurred))).toBe("rest");
  });

  test("ghost: it lingers 400 ms once the pointer leaves, and stays if it comes back", () => {
    const ghost = run([{ type: "pointer", to: "stage" }, { type: "dwell" }]);
    const leaving = run([{ type: "pointer", to: "away" }], ghost);
    expect(kind(leaving)).toBe("closing");
    expect(kind(run([{ type: "pointer", to: "stage" }], leaving))).toBe(
      "ghost"
    );
    expect(kind(run([{ type: "fade" }], leaving))).toBe("rest");
  });

  test("open: a click on the ghost or ? opens, and stays until closed", () => {
    const ghost = run([{ type: "pointer", to: "stage" }, { type: "dwell" }]);
    const open = run([{ type: "toggle" }], ghost);
    expect(open.panel).toEqual({ kind: "open", mark: null });
    expect(timers(run([{ type: "pointer", to: "away" }], open))).toEqual([]);
    expect(kind(run([pressM, { type: "lift" }], open))).toBe("open");
    // ? from anywhere on Home, with the pointer elsewhere.
    expect(run([{ type: "toggle" }]).panel).toEqual(open.panel);
  });

  test("closed: ?, × and Escape close, and the ghost stays under the pointer or lingers", () => {
    const open = run([{ type: "pointer", to: "stage" }, { type: "toggle" }]);
    expect(kind(run([{ type: "toggle" }], open))).toBe("ghost");
    expect(kind(run([{ type: "close" }], open))).toBe("ghost");
    const away = run([{ type: "pointer", to: "away" }], open);
    expect(kind(run([{ type: "close" }], away))).toBe("closing");
    expect(kind(run([{ type: "close" }]))).toBe("rest");
  });

  test("open: a mapped key marks its row with its cap held and its value fresh", () => {
    const pressed = run([{ type: "toggle" }, pressM]);
    expect(pressed.panel).toEqual({
      kind: "open",
      mark: { ...spotOf(M), code: "KeyM", fresh: true, press: 1 },
    });
    expect(pressed.held).toEqual([{ ...spotOf(M), code: "KeyM" }]);
    // While held, the value stays fresh.
    expect(timers(pressed)).toEqual([]);
    const lifted = run([{ type: "lift", code: "KeyM" }], pressed);
    expect(lifted.held).toEqual([]);
    expect(lifted.panel).toMatchObject({ mark: { fresh: true } });
    expect(timers(lifted)).toEqual([["settle", 1500]]);
    const settled = run([{ type: "settle", press: 1 }], lifted);
    expect(settled.panel).toMatchObject({
      kind: "open",
      mark: { fresh: false },
    });
  });

  test("open: another key's lift or an earlier press's settle leaves the mark", () => {
    const pressed = run([
      { type: "toggle" },
      pressM,
      { type: "lift", code: "KeyN" },
    ]);
    expect(pressed.held).toEqual([{ ...spotOf(M), code: "KeyM" }]);
    const again = run(
      [
        { type: "lift" },
        pressM,
        { type: "lift" },
        { type: "settle", press: 1 },
      ],
      pressed
    );
    expect(again.panel).toMatchObject({ mark: { press: 2, fresh: true } });
  });

  test("open: a sweep still held keeps its cap pressed through another key's press and lift", () => {
    const V = spotOf({ key: "v", code: "KeyV" })!;
    const X = spotOf({ key: "x", code: "KeyX" })!;
    const sweeping = run([
      { type: "toggle" },
      { type: "press", spot: V, code: "KeyV" },
      { type: "press", spot: X, code: "KeyX" },
      { type: "lift", code: "KeyX" },
    ]);
    expect(sweeping.panel).toMatchObject({ mark: { ...X, fresh: true } });
    expect(sweeping.held).toEqual([{ ...V, code: "KeyV" }]);
    expect(timers(sweeping)).toEqual([["settle", 1500]]);
  });

  test("closed: a key held when the controls open shows its cap pressed, with no mark yet", () => {
    const open = run([pressM, { type: "toggle" }]);
    expect(open.panel).toEqual({ kind: "open", mark: null });
    expect(open.held).toEqual([{ ...spotOf(M), code: "KeyM" }]);
  });

  test("closed: a mapped key plays without opening the controls", () => {
    expect(kind(run([pressM]))).toBe("rest");
    const ghost = run([{ type: "pointer", to: "stage" }, { type: "dwell" }]);
    expect(kind(run([pressM], ghost))).toBe("ghost");
  });

  test("leaving Home closes everything", () => {
    for (const events of [
      [pressM],
      [{ type: "toggle" }],
      [{ type: "ghostFocus", focused: true }],
    ] as ControlsEvent[][]) {
      expect(run([...events, { type: "leave" }])).toEqual(INITIAL_CONTROLS);
    }
  });
});

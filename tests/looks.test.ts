import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { AdminLook } from "@/convex/lib/looks";
import {
  applyPreset,
  DEFAULT_WAVEFORM_CONFIG,
  PRESET_ORDER,
  type StoredValue,
  type WaveformConfig,
} from "@/components/waveform/settings";
import {
  configKey,
  settle,
  toKeyedConfig,
  type KeyedConfig,
} from "@/components/looks/look";
import { shownConfig } from "@/components/looks/live";
import {
  FAILURE_LABEL,
  failureLabel,
  initialEditor,
  nextPreview,
  reduceEditor,
  REFUSAL_LABELS,
  renameLook,
  viewEditor,
  type EditorAction,
  type EditorState,
} from "@/components/looks/model";

function roundTrip(config: WaveformConfig): StoredValue {
  return JSON.parse(JSON.stringify(config));
}

function reverseKeys(value: StoredValue): StoredValue {
  return JSON.parse(
    JSON.stringify(value, (_, inner: unknown) =>
      inner instanceof Object && !Array.isArray(inner)
        ? Object.fromEntries(Object.entries(inner).reverse())
        : inner
    )
  );
}

function withHz(config: WaveformConfig, hz: number): WaveformConfig {
  return {
    ...config,
    tones: { ...config.tones, x: { ...config.tones.x, hz } },
  };
}

const circle = applyPreset(DEFAULT_WAVEFORM_CONFIG, "circle");

describe("toKeyedConfig", () => {
  it("draws the block default itself when no look is live", () => {
    expect(toKeyedConfig(null).config).toBe(DEFAULT_WAVEFORM_CONFIG);
  });

  it.each<StoredValue>(["golden", 7, [circle]])(
    "draws the block default for the non-object %s",
    (stored) => {
      expect(toKeyedConfig(stored).config).toBe(DEFAULT_WAVEFORM_CONFIG);
    }
  );

  it("draws a stored look", () => {
    expect(toKeyedConfig(roundTrip(circle)).config).toEqual(circle);
  });
});

describe("configKey", () => {
  it("ignores key order and unknown fields", () => {
    const key = configKey(circle);

    expect(configKey(roundTrip(circle))).toBe(key);
    expect(configKey(reverseKeys(circle) as StoredValue)).toBe(key);
    expect(configKey({ ...circle, extra: 1 })).toBe(key);
  });

  it("changes when the drawn content changes", () => {
    expect(configKey(withHz(circle, 330))).not.toBe(configKey(circle));
  });

  it("gives every preset its own key, and the same key after a JSON round trip", () => {
    const keys = PRESET_ORDER.map((id) => {
      const config = applyPreset(DEFAULT_WAVEFORM_CONFIG, id);
      const key = configKey(config);

      expect(configKey(roundTrip(config)), id).toBe(key);

      return key;
    });

    expect(new Set(keys).size).toBe(PRESET_ORDER.length);
  });
});

describe("settle", () => {
  const held: KeyedConfig = toKeyedConfig(roundTrip(circle));

  it.each<[string, StoredValue]>([
    ["a clone", structuredClone(circle)],
    ["the keys reversed", reverseKeys(circle)],
    ["an extra field", { ...circle, extra: 1 }],
  ])("keeps the held look for %s", (_, stored) => {
    expect(settle(held, stored)).toBe(held);
  });

  it("returns a new look when the content changes", () => {
    const next = settle(held, roundTrip(withHz(circle, 330)));

    expect(next).not.toBe(held);
    expect(next.config.tones.x.hz).toBe(330);
  });
});

describe("shownConfig", () => {
  const live = toKeyedConfig(circle);
  const play = withHz(circle, 180);

  it("draws the live look before a visitor plays", () => {
    expect(shownConfig(live, null)).toBe(live.config);
  });

  it("draws a visitor's play on the live look it was made on", () => {
    expect(shownConfig(live, { live, config: play })).toBe(play);
  });

  it("keeps a visitor's play when the same live look arrives as a new object", () => {
    const resent = settle(live, roundTrip(circle));

    expect(shownConfig(resent, { live, config: play })).toBe(play);
  });

  it("draws a new live look over a visitor's stale play", () => {
    const next = settle(live, applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette"));

    expect(shownConfig(next, { live, config: play })).toBe(next.config);
  });

  it("never brings a stale play back when the live look returns to it", () => {
    const away = settle(live, applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette"));
    const back = settle(away, roundTrip(circle));

    expect(back.key).toBe(live.key);
    expect(shownConfig(back, { live, config: play })).toBe(back.config);
  });
});

function lookId(value: string): Id<"looks"> {
  return value as Id<"looks">;
}

function adminLook(
  id: string,
  config: WaveformConfig,
  live = false
): AdminLook {
  return {
    id: lookId(id),
    name: `Look ${id}`,
    config: JSON.parse(JSON.stringify(config)),
    live,
  };
}

function run(...actions: EditorAction[]): EditorState {
  return actions.reduce(reduceEditor, initialEditor("key-1"));
}

const rosette = applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette");
const a = adminLook("a", circle, true);
const b = adminLook("b", rosette);
const looks = [b, a];
const edited = withHz(rosette, 330);

describe("viewEditor selection", () => {
  it("shows nothing without looks", () => {
    const view = viewEditor(run(), []);

    expect(view.selection).toBeNull();
    expect(view.rows).toEqual([]);
  });

  it("follows the live look until a look is selected, else the first", () => {
    expect(viewEditor(run(), looks).selection?.look.id).toBe("a");
    expect(
      viewEditor(run(), [b, { ...a, live: false }]).selection?.look.id
    ).toBe("b");
    expect(
      viewEditor(run({ type: "select", id: lookId("b") }), looks).selection
        ?.look.id
    ).toBe("b");
  });

  it("marks the shown look's row as selected", () => {
    const rows = viewEditor(run(), looks).rows;

    expect(rows.map((row) => [row.id, row.selected])).toEqual([
      ["b", false],
      ["a", true],
    ]);
  });

  it("keeps each look's draft when the selection moves", () => {
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "select", id: lookId("a") }
    );
    const view = viewEditor(state, looks);

    expect(view.selection?.look.id).toBe("a");
    expect(view.rows.find((row) => row.id === "b")?.unsaved).toBe(true);
    expect(
      viewEditor(
        reduceEditor(state, { type: "select", id: lookId("b") }),
        looks
      ).selection?.draft
    ).toBe(edited);
  });

  it("drops a vanished look's draft and falls back to the live look", () => {
    const state = run(
      { type: "select", id: lookId("gone") },
      { type: "edit", id: lookId("gone"), config: edited }
    );
    const view = viewEditor(state, looks);

    expect(view.selection?.look.id).toBe("a");
    expect(view.anyUnsaved).toBe(false);
  });
});

describe("viewEditor unsaved markers", () => {
  it("marks a look unsaved while its draft differs from what is stored", () => {
    const view = viewEditor(
      run({ type: "edit", id: lookId("b"), config: edited }),
      looks
    );

    expect(view.rows.map((row) => [row.id, row.unsaved])).toEqual([
      ["b", true],
      ["a", false],
    ]);
    expect(view.anyUnsaved).toBe(true);
  });

  it("reads a draft edited back to the stored content as saved", () => {
    const view = viewEditor(
      run({ type: "edit", id: lookId("b"), config: withHz(edited, 220) }),
      looks
    );

    expect(view.rows.every((row) => !row.unsaved)).toBe(true);
    expect(view.anyUnsaved).toBe(false);
  });

  it.fails("drops a draft edited back to the stored look, so a later save elsewhere shows that save", () => {
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "edit", id: lookId("b"), config: withHz(edited, 220) }
    );
    const savedElsewhere = [adminLook("b", withHz(rosette, 440)), a];
    const selection = viewEditor(state, savedElsewhere).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.save).toBeNull();
    expect(selection?.useOnSite).toEqual({ kind: "ready", id: "b" });
  });

  it("reads as saved and keeps the draft object once the list returns the saved content", () => {
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited }
    );
    const savedList = [adminLook("b", edited), a];
    const selection = viewEditor(state, savedList).selection;

    expect(selection?.unsaved).toBe(false);
    expect(selection?.draft).toBe(edited);
    expect(selection?.save).toBeNull();
  });

  it("drops the draft once its Save resolves, so a later save elsewhere doesn't read as unsaved", () => {
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "saved", id: lookId("b"), config: edited }
    );
    const savedElsewhere = [adminLook("b", withHz(rosette, 440)), a];
    const selection = viewEditor(state, savedElsewhere).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.unsaved).toBe(false);
  });

  it("keeps edits made while a Save ran", () => {
    const later = withHz(rosette, 550);
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "edit", id: lookId("b"), config: later },
      { type: "saved", id: lookId("b"), config: edited }
    );
    const selection = viewEditor(state, [adminLook("b", edited), a]).selection;

    expect(selection?.draft).toBe(later);
    expect(selection?.unsaved).toBe(true);
  });

  it("previews the stored look again after Discard", () => {
    const state = run(
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "discard", id: lookId("b") }
    );
    const selection = viewEditor(state, looks).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.unsaved).toBe(false);
  });
});

describe("viewEditor commands", () => {
  it("offers Use on site and Delete on a saved look that isn't live", () => {
    const selection = viewEditor(
      run({ type: "select", id: lookId("b") }),
      looks
    ).selection;

    expect(selection?.save).toBeNull();
    expect(selection?.discard).toBeNull();
    expect(selection?.useOnSite).toEqual({ kind: "ready", id: "b" });
    expect(selection?.remove).toEqual({ kind: "ready", id: "b" });
  });

  it("offers Save with the draft and holds Use on site while a look is unsaved", () => {
    const selection = viewEditor(
      run(
        { type: "select", id: lookId("b") },
        { type: "edit", id: lookId("b"), config: edited }
      ),
      looks
    ).selection;

    expect(selection?.save).toEqual({ id: "b", config: edited });
    expect(selection?.save?.config).toBe(edited);
    expect(selection?.discard).toBe("b");
    expect(selection?.useOnSite).toEqual({ kind: "unsaved" });
  });

  it("turns off Use on site and Delete for the live look", () => {
    for (const state of [
      run(),
      run({ type: "edit", id: lookId("a"), config: rosette }),
    ]) {
      const selection = viewEditor(state, looks).selection;

      expect(selection?.look.id).toBe("a");
      expect(selection?.useOnSite).toEqual({ kind: "live" });
      expect(selection?.remove).toEqual({ kind: "live" });
    }
  });

  it("creates with one key until a create resolves, then selects the new look", () => {
    expect(run().createKey).toBe("key-1");

    const state = run({
      type: "created",
      id: lookId("c"),
      nextCreateKey: "key-2",
    });
    const view = viewEditor(state, [
      ...looks,
      adminLook("c", DEFAULT_WAVEFORM_CONFIG),
    ]);

    expect(state.createKey).toBe("key-2");
    expect(view.selection?.look.id).toBe("c");
  });
});

describe("nextPreview", () => {
  const stored = toKeyedConfig(roundTrip(rosette));

  it("draws the draft object itself while there is one", () => {
    expect(nextPreview(stored, edited, rosette).config).toBe(edited);
  });

  it("keeps the saved draft's object when the draft gives way to the stored look", () => {
    const drafting = nextPreview(stored, edited, rosette);

    expect(nextPreview(drafting, null, roundTrip(edited))).toBe(drafting);
  });

  it("draws the stored look when the selection moves to a different look", () => {
    const next = nextPreview(stored, null, roundTrip(circle));

    expect(next).not.toBe(stored);
    expect(next.config).toEqual(circle);
  });
});

describe("renameLook", () => {
  it("renames to the name as typed", () => {
    expect(renameLook(b, " Night ")).toEqual({
      kind: "ready",
      args: { id: "b", name: " Night " },
    });
  });

  it("is off for the current name, once cleaned", () => {
    expect(renameLook(b, "  Look   b ")).toEqual({ kind: "unchanged" });
  });

  it("is off for a blank or too long name", () => {
    expect(renameLook(b, "   ")).toEqual({ kind: "invalid" });
    expect(renameLook(b, "x".repeat(61))).toEqual({ kind: "invalid" });
  });
});

describe("failureLabel", () => {
  it("labels each refusal by its code, and anything else with one fallback", () => {
    expect(failureLabel(new ConvexError({ code: "live" }))).toBe(
      REFUSAL_LABELS.live
    );
    expect(failureLabel(new ConvexError({ code: "other" }))).toBe(
      FAILURE_LABEL
    );
    expect(failureLabel(new Error("Admin role required"))).toBe(FAILURE_LABEL);
  });
});

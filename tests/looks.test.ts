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
  {
    live = false,
    version = 0,
    usedBy = [],
  }: Partial<Pick<AdminLook, "live" | "version" | "usedBy">> = {}
): AdminLook {
  return {
    id: lookId(id),
    name: `Look ${id}`,
    config: JSON.parse(JSON.stringify(config)),
    version,
    live,
    usedBy,
  };
}

function run(...actions: EditorAction[]): EditorState {
  return actions.reduce(reduceEditor, initialEditor("key-1"));
}

function listed(looks: readonly AdminLook[]): EditorAction {
  return { type: "listed", looks };
}

const rosette = applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette");
const a = adminLook("a", circle, { live: true });
const b = adminLook("b", rosette);
const looks = [b, a];
const lowTide = { id: 3, title: "Low Tide" };
const edited = withHz(rosette, 330);
const savedElsewhere = [
  adminLook("b", withHz(rosette, 440), { version: 1 }),
  a,
];

describe("viewEditor selection", () => {
  it("shows nothing before the first list or without looks", () => {
    for (const state of [run(), run(listed([]))]) {
      const view = viewEditor(state);

      expect(view.selection).toBeNull();
      expect(view.rows).toEqual([]);
    }
  });

  it("follows the live look until a look is selected, else the first", () => {
    expect(viewEditor(run(listed(looks))).selection?.look.id).toBe("a");
    expect(
      viewEditor(run(listed([b, { ...a, live: false }]))).selection?.look.id
    ).toBe("b");
    expect(
      viewEditor(run(listed(looks), { type: "select", id: lookId("b") }))
        .selection?.look.id
    ).toBe("b");
  });

  it("marks the shown look's row as selected", () => {
    const rows = viewEditor(run(listed(looks))).rows;

    expect(rows.map((row) => [row.id, row.selected])).toEqual([
      ["b", false],
      ["a", true],
    ]);
  });

  it("keeps each look's draft when the selection moves", () => {
    const state = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "select", id: lookId("a") }
    );
    const view = viewEditor(state);

    expect(view.selection?.look.id).toBe("a");
    expect(view.rows.find((row) => row.id === "b")?.unsaved).toBe(true);
    expect(
      viewEditor(reduceEditor(state, { type: "select", id: lookId("b") }))
        .selection?.draft
    ).toBe(edited);
  });

  it("drops a vanished look's draft and falls back to the live look", () => {
    const c = adminLook("c", circle);
    const state = run(
      listed([...looks, c]),
      { type: "select", id: lookId("c") },
      { type: "edit", id: lookId("c"), config: edited },
      listed(looks)
    );
    const view = viewEditor(state);

    expect(view.selection?.look.id).toBe("a");
    expect(view.anyUnsaved).toBe(false);
  });
});

describe("viewEditor unsaved markers", () => {
  it("marks a look unsaved while its draft differs from what is stored", () => {
    const view = viewEditor(
      run(listed(looks), { type: "edit", id: lookId("b"), config: edited })
    );

    expect(view.rows.map((row) => [row.id, row.unsaved])).toEqual([
      ["b", true],
      ["a", false],
    ]);
    expect(view.anyUnsaved).toBe(true);
  });

  it("drops a draft edited back to the stored look", () => {
    const view = viewEditor(
      run(
        listed(looks),
        { type: "select", id: lookId("b") },
        { type: "edit", id: lookId("b"), config: edited },
        { type: "edit", id: lookId("b"), config: withHz(edited, 220) }
      )
    );

    expect(view.rows.every((row) => !row.unsaved)).toBe(true);
    expect(view.anyUnsaved).toBe(false);
    expect(view.selection?.draft).toBeNull();
  });

  it("drops a draft edited back to the stored look, so a later save elsewhere shows that save", () => {
    const state = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "edit", id: lookId("b"), config: withHz(edited, 220) },
      listed(savedElsewhere)
    );
    const selection = viewEditor(state).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.save).toBeNull();
    expect(selection?.useOnSite).toEqual({ kind: "ready", id: "b" });
  });

  it("drops the draft when the list returns its content, and the preview keeps its object", () => {
    const state = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited }
    );
    const drafting = nextPreview(toKeyedConfig(b.config), edited, b.config);
    const savedLook = adminLook("b", edited, { version: 1 });
    const selection = viewEditor(
      reduceEditor(state, listed([savedLook, a]))
    ).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.save).toBeNull();
    expect(nextPreview(drafting, null, savedLook.config)).toBe(drafting);
  });

  it("keeps drafts and the preview object through a list that changes only which tracks use each look", () => {
    const state = run(listed(looks), {
      type: "edit",
      id: lookId("b"),
      config: edited,
    });
    const shown = toKeyedConfig(a.config);
    const usedA = adminLook("a", circle, { live: true, usedBy: [lowTide] });
    const relisted = reduceEditor(
      state,
      listed([adminLook("b", rosette, { usedBy: [lowTide] }), usedA])
    );

    expect(viewEditor(relisted).selection?.look).toBe(usedA);
    expect(nextPreview(shown, null, usedA.config)).toBe(shown);
    expect(
      viewEditor(reduceEditor(relisted, { type: "select", id: lookId("b") }))
        .selection?.draft
    ).toBe(edited);
  });

  it("drops the draft once its Save resolves, so a later save elsewhere doesn't read as unsaved", () => {
    const state = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "save", id: lookId("b"), config: edited },
      { type: "saved", id: lookId("b"), version: 1 },
      listed([adminLook("b", withHz(rosette, 440), { version: 2 }), a])
    );
    const selection = viewEditor(state).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.save).toBeNull();
  });

  it("keeps edits made while a Save ran on the version it stored, whichever arrives first", () => {
    const later = withHz(rosette, 550);
    const start = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "save", id: lookId("b"), config: edited },
      { type: "edit", id: lookId("b"), config: later }
    );
    const saved: EditorAction = { type: "saved", id: lookId("b"), version: 1 };
    const relisted = listed([adminLook("b", edited, { version: 1 }), a]);

    for (const order of [
      [saved, relisted],
      [relisted, saved],
    ]) {
      const selection = viewEditor(order.reduce(reduceEditor, start)).selection;

      expect(selection?.draft).toBe(later);
      expect(selection?.save).toEqual({
        id: "b",
        baseVersion: 1,
        config: later,
      });
      expect(selection?.keep).toBeNull();
    }
  });

  it("previews the stored look again after Discard", () => {
    const state = run(
      listed(looks),
      { type: "select", id: lookId("b") },
      { type: "edit", id: lookId("b"), config: edited },
      { type: "discard", id: lookId("b") }
    );
    const selection = viewEditor(state).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.discard).toBeNull();
  });
});

describe("viewEditor stale drafts", () => {
  const stale = run(
    listed(looks),
    { type: "select", id: lookId("b") },
    { type: "edit", id: lookId("b"), config: edited },
    listed(savedElsewhere)
  );

  it("holds Save and offers Keep or Discard once another tab saves a newer version", () => {
    const view = viewEditor(stale);

    expect(view.selection?.draft).toBe(edited);
    expect(view.selection?.save).toBeNull();
    expect(view.selection?.keep).toBe("b");
    expect(view.selection?.discard).toBe("b");
    expect(view.selection?.useOnSite).toEqual({ kind: "unsaved" });
    expect(view.rows.find((row) => row.id === "b")?.unsaved).toBe(true);
  });

  it("moves a kept draft onto the newer version, so its Save replaces that save", () => {
    const selection = viewEditor(
      reduceEditor(stale, { type: "keep", id: lookId("b") })
    ).selection;

    expect(selection?.keep).toBeNull();
    expect(selection?.save).toEqual({
      id: "b",
      baseVersion: 1,
      config: edited,
    });
  });

  it("shows the newer save after Discard", () => {
    const selection = viewEditor(
      reduceEditor(stale, { type: "discard", id: lookId("b") })
    ).selection;

    expect(selection?.draft).toBeNull();
    expect(selection?.keep).toBeNull();
    expect(selection?.look.config).toEqual(savedElsewhere[0].config);
  });

  it("drops a draft another tab saved as is, so a later save never brings it back", () => {
    const state = run(
      listed(looks),
      { type: "edit", id: lookId("b"), config: edited },
      listed([adminLook("b", edited, { version: 1 }), a]),
      listed([adminLook("b", withHz(rosette, 440), { version: 2 }), a])
    );

    expect(viewEditor(state).anyUnsaved).toBe(false);
  });
});

describe("viewEditor running Save", () => {
  const save: EditorAction = { type: "save", id: lookId("b"), config: edited };
  const saving = run(
    listed(looks),
    { type: "select", id: lookId("b") },
    { type: "edit", id: lookId("b"), config: edited },
    save
  );
  const back = roundTrip(rosette) as WaveformConfig;
  const relisted = listed([adminLook("b", edited, { version: 1 }), a]);
  const saved: EditorAction = { type: "saved", id: lookId("b"), version: 1 };
  const failed: EditorAction = { type: "saveFailed", id: lookId("b") };

  it("keeps an edit back to the stored look while a Save runs, whichever arrives first", () => {
    const start = reduceEditor(saving, {
      type: "edit",
      id: lookId("b"),
      config: back,
    });

    for (const order of [
      [saved, relisted],
      [relisted, saved],
    ]) {
      const selection = viewEditor(order.reduce(reduceEditor, start)).selection;

      expect(configKey(selection!.look.config)).toBe(configKey(edited));
      expect(selection?.draft).toBe(back);
      expect(selection?.save).toEqual({
        id: "b",
        baseVersion: 1,
        config: back,
      });
    }
  });

  it("keeps an edit back to the stored look through a list that still shows it mid-Save, such as a rename elsewhere", () => {
    const renamed = listed([{ ...b, name: "Dusk" }, a]);
    const steps: EditorAction[] = [
      { type: "edit", id: lookId("b"), config: back },
      renamed,
    ];
    const start = steps.reduce(reduceEditor, saving);

    for (const order of [
      [saved, relisted],
      [relisted, saved],
    ]) {
      const selection = viewEditor(order.reduce(reduceEditor, start)).selection;

      expect(selection?.draft).toBe(back);
      expect(selection?.save).toEqual({
        id: "b",
        baseVersion: 1,
        config: back,
      });
    }
  });

  it("holds Save, Keep, and Discard while a Save runs, and keeps the look unsaved", () => {
    for (const state of [saving, reduceEditor(saving, relisted)]) {
      const view = viewEditor(state);

      expect(view.selection?.draft).toBe(edited);
      expect(view.selection?.save).toBeNull();
      expect(view.selection?.keep).toBeNull();
      expect(view.selection?.discard).toBeNull();
      expect(view.rows.find((row) => row.id === "b")?.unsaved).toBe(true);
      expect(view.anyUnsaved).toBe(true);
    }
  });

  it("keeps the draft after a failed Save so it can be saved again", () => {
    const selection = viewEditor(reduceEditor(saving, failed)).selection;

    expect(selection?.draft).toBe(edited);
    expect(selection?.save).toEqual({
      id: "b",
      baseVersion: 0,
      config: edited,
    });
    expect(selection?.discard).toBe("b");
  });

  it("keeps the draft stale after a Save refused because another tab saved first", () => {
    const selection = viewEditor(
      [listed(savedElsewhere), failed].reduce(reduceEditor, saving)
    ).selection;

    expect(selection?.draft).toBe(edited);
    expect(selection?.save).toBeNull();
    expect(selection?.keep).toBe("b");
    expect(selection?.discard).toBe("b");
  });

  it("drops the draft after a failed Save when the edits went back to the stored look", () => {
    const state = [
      { type: "edit", id: lookId("b"), config: back } as EditorAction,
      failed,
    ].reduce(reduceEditor, saving);

    expect(viewEditor(state).anyUnsaved).toBe(false);
  });

  it("drops the draft when edits made during the Save end on what it sent", () => {
    const state = [
      {
        type: "edit",
        id: lookId("b"),
        config: withHz(rosette, 550),
      } as EditorAction,
      {
        type: "edit",
        id: lookId("b"),
        config: roundTrip(edited) as WaveformConfig,
      } as EditorAction,
      saved,
      relisted,
    ].reduce(reduceEditor, saving);

    expect(viewEditor(state).anyUnsaved).toBe(false);
  });

  it("keeps an edit that arrived after the Save left but before it was recorded", () => {
    const later = withHz(rosette, 550);
    const state = run(
      listed(looks),
      { type: "edit", id: lookId("b"), config: edited },
      { type: "edit", id: lookId("b"), config: later },
      save,
      saved,
      relisted
    );

    expect(
      viewEditor(reduceEditor(state, { type: "select", id: lookId("b") }))
        .selection?.save
    ).toEqual({ id: "b", baseVersion: 1, config: later });
  });

  it("drops a draft another tab saved as is while the Save ran", () => {
    const state = [listed(savedElsewhere), failed].reduce(
      reduceEditor,
      reduceEditor(saving, {
        type: "edit",
        id: lookId("b"),
        config: withHz(rosette, 440),
      })
    );

    expect(viewEditor(state).anyUnsaved).toBe(false);
  });

  it("puts edits made during a Save behind a newer save from another tab that listed first", () => {
    const later = withHz(rosette, 550);
    const newer = listed([
      adminLook("b", withHz(rosette, 660), { version: 2 }),
      a,
    ]);
    const selection = viewEditor(
      [
        { type: "edit", id: lookId("b"), config: later } as EditorAction,
        newer,
        saved,
      ].reduce(reduceEditor, saving)
    ).selection;

    expect(selection?.draft).toBe(later);
    expect(selection?.save).toBeNull();
    expect(selection?.keep).toBe("b");
  });

  it("drops the draft when another tab's newer save lists before the Save ends, whichever arrives first", () => {
    const newer = listed([
      adminLook("b", withHz(rosette, 660), { version: 2 }),
      a,
    ]);

    for (const order of [
      [newer, saved],
      [saved, newer],
    ]) {
      expect(viewEditor(order.reduce(reduceEditor, saving)).anyUnsaved).toBe(
        false
      );
    }
  });

  it("drops edits made during a Save that another tab then saved as is, whichever arrives first", () => {
    const start = reduceEditor(saving, {
      type: "edit",
      id: lookId("b"),
      config: withHz(rosette, 660),
    });
    const newer = listed([
      adminLook("b", withHz(rosette, 660), { version: 2 }),
      a,
    ]);

    for (const order of [
      [newer, saved],
      [saved, newer],
    ]) {
      expect(viewEditor(order.reduce(reduceEditor, start)).anyUnsaved).toBe(
        false
      );
    }
  });

  it("ignores a Save end with no Save running, and a second end", () => {
    const once = [saved, relisted].reduce(reduceEditor, saving);

    expect([saved, failed].reduce(reduceEditor, once)).toEqual(once);
    expect(
      viewEditor(
        run(
          listed(looks),
          { type: "select", id: lookId("b") },
          { type: "edit", id: lookId("b"), config: edited },
          saved
        )
      ).selection?.save
    ).toEqual({ id: "b", baseVersion: 0, config: edited });
  });

  it("ignores Keep and Discard while a Save runs", () => {
    const state = run(
      listed(looks),
      { type: "edit", id: lookId("b"), config: edited },
      save,
      listed(savedElsewhere)
    );

    expect(
      [
        { type: "keep", id: lookId("b") } as EditorAction,
        { type: "discard", id: lookId("b") } as EditorAction,
      ].reduce(reduceEditor, state)
    ).toEqual(state);
  });

  it("forgets a running Save whose look another tab deleted", () => {
    const state = [listed([a]), failed].reduce(reduceEditor, saving);

    expect(viewEditor(state).anyUnsaved).toBe(false);
  });
});

describe("viewEditor commands", () => {
  it("offers Use on site and Delete on a saved look that isn't live", () => {
    const selection = viewEditor(
      run(listed(looks), { type: "select", id: lookId("b") })
    ).selection;

    expect(selection?.save).toBeNull();
    expect(selection?.discard).toBeNull();
    expect(selection?.keep).toBeNull();
    expect(selection?.useOnSite).toEqual({ kind: "ready", id: "b" });
    expect(selection?.remove).toEqual({ kind: "ready", id: "b" });
  });

  it("offers Save with the draft and its version, and holds Use on site while a look is unsaved", () => {
    const selection = viewEditor(
      run(
        listed(looks),
        { type: "select", id: lookId("b") },
        { type: "edit", id: lookId("b"), config: edited }
      )
    ).selection;

    expect(selection?.save).toEqual({
      id: "b",
      baseVersion: 0,
      config: edited,
    });
    expect(selection?.save?.config).toBe(edited);
    expect(selection?.discard).toBe("b");
    expect(selection?.useOnSite).toEqual({ kind: "unsaved" });
  });

  it("turns off Use on site and Delete for the live look", () => {
    for (const state of [
      run(listed(looks)),
      run(listed(looks), { type: "edit", id: lookId("a"), config: rosette }),
    ]) {
      const selection = viewEditor(state).selection;

      expect(selection?.look.id).toBe("a");
      expect(selection?.useOnSite).toEqual({ kind: "live" });
      expect(selection?.remove).toEqual({ kind: "held", code: "live" });
    }
  });

  it("holds Delete for a look tracks use, and keeps Use on site", () => {
    const selection = viewEditor(
      run(listed([adminLook("b", rosette, { usedBy: [lowTide] }), a]), {
        type: "select",
        id: lookId("b"),
      })
    ).selection;

    expect(selection?.remove).toEqual({ kind: "held", code: "used" });
    expect(selection?.useOnSite).toEqual({ kind: "ready", id: "b" });
  });

  it("holds Delete as live when tracks use the live look too", () => {
    const selection = viewEditor(
      run(
        listed([b, adminLook("a", circle, { live: true, usedBy: [lowTide] })])
      )
    ).selection;

    expect(selection?.remove).toEqual({ kind: "held", code: "live" });
  });

  it("offers Delete again once the last track stops using the look", () => {
    const selection = viewEditor(
      run(
        listed([adminLook("b", rosette, { usedBy: [lowTide] }), a]),
        { type: "select", id: lookId("b") },
        listed(looks)
      )
    ).selection;

    expect(selection?.remove).toEqual({ kind: "ready", id: "b" });
  });

  it("creates with one key until a create resolves, then selects the new look", () => {
    expect(run().createKey).toBe("key-1");

    const state = run(listed(looks), {
      type: "created",
      id: lookId("c"),
      nextCreateKey: "key-2",
    });
    const view = viewEditor(
      reduceEditor(
        state,
        listed([...looks, adminLook("c", DEFAULT_WAVEFORM_CONFIG)])
      )
    );

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
    expect(failureLabel(new ConvexError({ code: "used" }))).toBe(
      REFUSAL_LABELS.used
    );
    expect(failureLabel(new ConvexError({ code: "other" }))).toBe(
      FAILURE_LABEL
    );
    expect(failureLabel(new Error("Admin role required"))).toBe(FAILURE_LABEL);
  });
});

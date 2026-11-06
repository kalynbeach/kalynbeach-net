import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  cleanName,
  isLookRefusal,
  lookNameProblem,
  lookUsage,
  MAX_CONFIG_BYTES,
  MAX_NAME_LENGTH,
  planCreate,
  planRemove,
  planRename,
  planSave,
  planSetLive,
  refuse,
  removeProblem,
  toAdminLook,
  type Look,
  type LookConfig,
  type Site,
  type TrackRef,
} from "@/convex/lib/looks";

function lookId(value: string): Id<"looks"> {
  return value as Id<"looks">;
}

const config: LookConfig = { source: "tones", tones: { x: { hz: 140 } } };
const otherConfig: LookConfig = { source: "audio" };
const thirdConfig: LookConfig = { source: "tones", tones: { x: { hz: 90 } } };

function configOfBytes(bytes: number): LookConfig {
  const padding = bytes - JSON.stringify({ pad: "" }).length;

  return { pad: "x".repeat(padding) };
}

function look(id: string, fields: Partial<Look> = {}): Look {
  return {
    _id: lookId(id),
    _creationTime: 1,
    name: `Look ${id}`,
    config,
    version: 0,
    createKey: `key-${id}`,
    createdAt: 10,
    updatedAt: 20,
    ...fields,
  };
}

function siteOn(id: string): Site {
  return {
    _id: "site-row" as Id<"site">,
    _creationTime: 1,
    liveLook: lookId(id),
  };
}

const a = look("a");
const b = look("b");
const lowTide: TrackRef = { id: 3, title: "Low Tide" };

describe("names", () => {
  it("cleans a name by trimming and collapsing inner whitespace", () => {
    expect(cleanName("  Dusk   glow ")).toBe("Dusk glow");
    expect(lookNameProblem("  Dusk  ")).toBeNull();
  });

  it("refuses a blank name", () => {
    expect(lookNameProblem("   ")).toBe("name");
    expect(lookNameProblem("")).toBe("name");
  });

  it("accepts the longest name and refuses one character more", () => {
    expect(lookNameProblem("x".repeat(MAX_NAME_LENGTH))).toBeNull();
    expect(lookNameProblem("x".repeat(MAX_NAME_LENGTH + 1))).toBe("name");
  });
});

describe("planCreate", () => {
  const input = { createKey: "k1", name: " Dusk ", config };

  it("inserts the cleaned name and the config as sent", () => {
    expect(planCreate(null, input, 5)).toEqual({
      kind: "insert",
      look: {
        name: "Dusk",
        config,
        version: 0,
        createKey: "k1",
        createdAt: 5,
        updatedAt: 5,
      },
    });
  });

  it("returns the look already made with the same createKey", () => {
    const made = look("made", { createKey: "k1" });

    expect(planCreate(made, input, 9)).toEqual({
      kind: "existing",
      id: lookId("made"),
    });
  });

  it("never refuses a retry, even when the input would be refused now", () => {
    const made = look("made", { createKey: "k1" });

    expect(planCreate(made, { ...input, name: "" }, 9).kind).toBe("existing");
    expect(
      planCreate(
        made,
        { ...input, config: configOfBytes(MAX_CONFIG_BYTES + 1) },
        9
      ).kind
    ).toBe("existing");
  });

  it("refuses a blank name", () => {
    expect(planCreate(null, { ...input, name: "  " }, 5)).toEqual({
      kind: "refuse",
      code: "name",
    });
  });

  it("refuses a config holding a value JSON can't carry", () => {
    for (const odd of [new ArrayBuffer(8), BigInt(5), Number.NaN, Infinity]) {
      expect(
        planCreate(null, { ...input, config: { ...config, odd } }, 5)
      ).toEqual({ kind: "refuse", code: "config" });
    }
  });

  it("measures the size cap in UTF-8 bytes, not characters", () => {
    const twoByteChars = { pad: "é".repeat(MAX_CONFIG_BYTES / 2) };

    expect(planCreate(null, { ...input, config: twoByteChars }, 5)).toEqual({
      kind: "refuse",
      code: "config",
    });
  });

  it("accepts a config at the size cap and refuses one byte more", () => {
    expect(
      planCreate(null, { ...input, config: configOfBytes(MAX_CONFIG_BYTES) }, 5)
        .kind
    ).toBe("insert");
    expect(
      planCreate(
        null,
        { ...input, config: configOfBytes(MAX_CONFIG_BYTES + 1) },
        5
      )
    ).toEqual({ kind: "refuse", code: "config" });
  });
});

describe("planSave", () => {
  const saved = { ...a, config: otherConfig, version: 1 };

  it("refuses a missing look", () => {
    expect(planSave(null, { baseVersion: 0, config }, 5)).toEqual({
      kind: "refuse",
      code: "missing",
    });
  });

  it("saves a draft from the stored version as the next version, leaving the name alone", () => {
    expect(planSave(a, { baseVersion: 0, config: otherConfig }, 9)).toEqual({
      kind: "patch",
      patch: { config: otherConfig, version: 1, updatedAt: 9 },
    });
  });

  it("refuses a draft from an older version, so it never replaces another tab's save", () => {
    expect(
      planSave(saved, { baseVersion: 0, config: thirdConfig }, 12)
    ).toEqual({
      kind: "refuse",
      code: "stale",
    });
  });

  it("writes nothing when the config is already stored, so a retry of a landed save returns its version", () => {
    expect(
      planSave(saved, { baseVersion: 0, config: otherConfig }, 12)
    ).toEqual({
      kind: "unchanged",
      version: 1,
    });
    expect(
      planSave(
        { ...saved, config: { b: 2, a: { d: 4, c: 3 } } },
        { baseVersion: 0, config: { a: { c: 3, d: 4 }, b: 2 } },
        12
      ).kind
    ).toBe("unchanged");
  });

  it("refuses a config holding bytes", () => {
    expect(
      planSave(
        a,
        { baseVersion: 0, config: { ...config, blob: new ArrayBuffer(8) } },
        9
      )
    ).toEqual({ kind: "refuse", code: "config" });
  });

  it("refuses a config over the size cap", () => {
    expect(
      planSave(
        a,
        { baseVersion: 0, config: configOfBytes(MAX_CONFIG_BYTES + 1) },
        9
      )
    ).toEqual({ kind: "refuse", code: "config" });
  });
});

describe("planRename", () => {
  it("refuses a missing look", () => {
    expect(planRename(null, "Night", 5)).toEqual({
      kind: "refuse",
      code: "missing",
    });
  });

  it("stores the cleaned name and leaves the config alone", () => {
    expect(planRename(a, "  Night   sky ", 9)).toEqual({
      kind: "patch",
      patch: { name: "Night sky", updatedAt: 9 },
    });
  });

  it("refuses a blank or too long name", () => {
    expect(planRename(a, " ", 9)).toEqual({ kind: "refuse", code: "name" });
    expect(planRename(a, "x".repeat(MAX_NAME_LENGTH + 1), 9)).toEqual({
      kind: "refuse",
      code: "name",
    });
  });
});

describe("removeProblem", () => {
  it("names live before used, and nothing for a look nothing uses", () => {
    expect(removeProblem({ live: true, usedBy: [lowTide] })).toBe("live");
    expect(removeProblem({ live: true, usedBy: [] })).toBe("live");
    expect(removeProblem({ live: false, usedBy: [lowTide] })).toBe("used");
    expect(removeProblem({ live: false, usedBy: [] })).toBeNull();
  });
});

describe("planRemove", () => {
  it("does nothing for a look that is already gone, even one tracks use", () => {
    expect(planRemove(null, lookUsage(a, siteOn("a"), [lowTide]))).toEqual({
      kind: "gone",
    });
  });

  it("refuses the live look", () => {
    expect(planRemove(a, lookUsage(a, siteOn("a"), []))).toEqual({
      kind: "refuse",
      code: "live",
    });
  });

  it("refuses a look a track uses", () => {
    expect(planRemove(b, lookUsage(b, siteOn("a"), [lowTide]))).toEqual({
      kind: "refuse",
      code: "used",
    });
  });

  it("refuses the live look as live when tracks use it too", () => {
    expect(planRemove(a, lookUsage(a, siteOn("a"), [lowTide]))).toEqual({
      kind: "refuse",
      code: "live",
    });
  });

  it("deletes a look that isn't live and no track uses", () => {
    expect(planRemove(b, lookUsage(b, siteOn("a"), []))).toEqual({
      kind: "delete",
      id: lookId("b"),
    });
  });

  it("deletes any unused look before the first setLive", () => {
    expect(planRemove(a, lookUsage(a, null, []))).toEqual({
      kind: "delete",
      id: lookId("a"),
    });
  });
});

describe("planSetLive", () => {
  it("refuses a missing look", () => {
    expect(planSetLive(null, siteOn("a"))).toEqual({
      kind: "refuse",
      code: "missing",
    });
  });

  it("inserts the site row on the first setLive", () => {
    expect(planSetLive(a, null)).toEqual({
      kind: "insert",
      site: { liveLook: lookId("a") },
    });
  });

  it("writes nothing when the look is already live", () => {
    expect(planSetLive(a, siteOn("a"))).toEqual({ kind: "unchanged" });
  });

  it("points the site row at another look", () => {
    expect(planSetLive(b, siteOn("a"))).toEqual({
      kind: "patch",
      id: "site-row",
      site: { liveLook: lookId("b") },
    });
  });
});

describe("toAdminLook", () => {
  it("marks only the look the site row points at as live", () => {
    expect(toAdminLook(a, lookUsage(a, siteOn("a"), []))).toEqual({
      id: lookId("a"),
      name: "Look a",
      config,
      version: 0,
      live: true,
      usedBy: [],
    });
    expect(toAdminLook(b, lookUsage(b, siteOn("a"), [])).live).toBe(false);
    expect(toAdminLook(a, lookUsage(a, null, [])).live).toBe(false);
  });

  it("carries the tracks that use the look", () => {
    expect(toAdminLook(b, lookUsage(b, siteOn("a"), [lowTide])).usedBy).toEqual(
      [lowTide]
    );
  });
});

describe("refusals", () => {
  it("throws a ConvexError carrying the code", () => {
    const thrown = (() => {
      try {
        refuse("live");
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(ConvexError);
    expect(thrown instanceof ConvexError && thrown.data).toEqual({
      code: "live",
    });
  });

  it("recognizes a looks refusal and nothing else", () => {
    expect(isLookRefusal({ code: "config" })).toBe(true);
    expect(isLookRefusal({ code: "used" })).toBe(true);
    expect(isLookRefusal({ code: "other" })).toBe(false);
    expect(isLookRefusal("live")).toBe(false);
    expect(isLookRefusal(null)).toBe(false);
  });
});

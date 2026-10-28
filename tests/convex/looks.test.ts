import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  cleanName,
  isLookRefusal,
  lookNameProblem,
  MAX_CONFIG_JSON_LENGTH,
  MAX_NAME_LENGTH,
  planCreate,
  planRemove,
  planRename,
  planSave,
  planSetLive,
  refuse,
  toAdminLook,
  type Look,
  type LookConfig,
  type Site,
} from "@/convex/lib/looks";

function lookId(value: string): Id<"looks"> {
  return value as Id<"looks">;
}

const config: LookConfig = { source: "tones", tones: { x: { hz: 140 } } };
const otherConfig: LookConfig = { source: "audio" };

function configOfLength(length: number): LookConfig {
  const padding = length - JSON.stringify({ pad: "" }).length;

  return { pad: "x".repeat(padding) };
}

function look(id: string, fields: Partial<Look> = {}): Look {
  return {
    _id: lookId(id),
    _creationTime: 1,
    name: `Look ${id}`,
    config,
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
        { ...input, config: configOfLength(MAX_CONFIG_JSON_LENGTH + 1) },
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

  it("accepts a config at the size cap and refuses one character more", () => {
    expect(
      planCreate(
        null,
        { ...input, config: configOfLength(MAX_CONFIG_JSON_LENGTH) },
        5
      ).kind
    ).toBe("insert");
    expect(
      planCreate(
        null,
        { ...input, config: configOfLength(MAX_CONFIG_JSON_LENGTH + 1) },
        5
      )
    ).toEqual({ kind: "refuse", code: "config" });
  });
});

describe("planSave", () => {
  it("refuses a missing look", () => {
    expect(planSave(null, config, 5)).toEqual({
      kind: "refuse",
      code: "missing",
    });
  });

  it("replaces the config and moves updatedAt, leaving the name alone", () => {
    expect(planSave(a, otherConfig, 9)).toEqual({
      kind: "patch",
      patch: { config: otherConfig, updatedAt: 9 },
    });
  });

  it("writes the same config again when it runs twice", () => {
    const saved = { ...a, config: otherConfig, updatedAt: 9 };

    expect(planSave(saved, otherConfig, 12)).toEqual({
      kind: "patch",
      patch: { config: otherConfig, updatedAt: 12 },
    });
  });

  it("refuses a config over the size cap", () => {
    expect(planSave(a, configOfLength(MAX_CONFIG_JSON_LENGTH + 1), 9)).toEqual({
      kind: "refuse",
      code: "config",
    });
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

describe("planRemove", () => {
  it("does nothing for a look that is already gone", () => {
    expect(planRemove(null, siteOn("a"))).toEqual({ kind: "gone" });
  });

  it("refuses the live look", () => {
    expect(planRemove(a, siteOn("a"))).toEqual({
      kind: "refuse",
      code: "live",
    });
  });

  it("deletes a look that isn't live", () => {
    expect(planRemove(b, siteOn("a"))).toEqual({
      kind: "delete",
      id: lookId("b"),
    });
  });

  it("deletes any look before the first setLive", () => {
    expect(planRemove(a, null)).toEqual({ kind: "delete", id: lookId("a") });
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
    expect(toAdminLook(a, siteOn("a"))).toEqual({
      id: lookId("a"),
      name: "Look a",
      config,
      live: true,
    });
    expect(toAdminLook(b, siteOn("a")).live).toBe(false);
    expect(toAdminLook(a, null).live).toBe(false);
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
    expect(isLookRefusal({ code: "other" })).toBe(false);
    expect(isLookRefusal("live")).toBe(false);
    expect(isLookRefusal(null)).toBe(false);
  });
});

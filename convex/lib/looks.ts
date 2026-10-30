import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * A stored WaveformConfig. Convex never imports the waveform block: it
 * stores the object the dashboard sends, and every reader passes it through
 * the block's parseWaveformConfig. A record, so a number, an array, or null
 * never reaches storage.
 */
export const lookConfigValidator = v.record(v.string(), v.any());

export const lookValidator = v.object({
  name: v.string(),
  config: lookConfigValidator,
  /**
   * Counts the saves that changed the config, from 0 at create. A dashboard
   * draft carries the version it started from, and save() refuses a draft
   * whose version has moved on, so a save never silently replaces another
   * tab's.
   */
  version: v.number(),
  /**
   * The key the dashboard sent to create this look. create() with a key
   * that already has a look returns that look, so a double click makes one.
   */
  createKey: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * The site's one settings row, absent until the first setLive inserts it.
 * A single pointer, so two live looks can't be represented, and remove()
 * refuses the look it names, so it never dangles.
 */
export const siteValidator = v.object({
  liveLook: v.id("looks"),
});

export const liveLookValidator = v.union(lookConfigValidator, v.null());

/** A track as a look names it: its publicId and title. */
export const trackRefValidator = v.object({
  id: v.number(),
  title: v.string(),
});

/**
 * A dashboard row. `live` comes from the site row and `usedBy` from the
 * tracks that name the look, in publicId order. The look stores neither.
 */
export const adminLookValidator = v.object({
  id: v.id("looks"),
  name: v.string(),
  config: lookConfigValidator,
  version: v.number(),
  live: v.boolean(),
  usedBy: v.array(trackRefValidator),
});

export type LookConfig = Infer<typeof lookConfigValidator>;
export type TrackRef = Infer<typeof trackRefValidator>;
export type AdminLook = Infer<typeof adminLookValidator>;
export type LookId = Id<"looks">;
export type Look = Doc<"looks">;
export type Site = Doc<"site">;

export const MAX_NAME_LENGTH = 60;

export const MAX_CONFIG_BYTES = 16 * 1024;

/**
 * Why a looks mutation refused. Plain Error messages may reach the client
 * as "Server Error", so refusals travel as ConvexError data, and the
 * dashboard maps each code to its own label.
 */
export const LOOK_REFUSAL_CODES = [
  "live",
  "used",
  "missing",
  "name",
  "config",
  "stale",
] as const;

export type LookRefusalCode = (typeof LOOK_REFUSAL_CODES)[number];

export type LookRefusal = { readonly code: LookRefusalCode };

export function refuse(code: LookRefusalCode): never {
  throw new ConvexError<LookRefusal>({ code });
}

export function isLookRefusal(data: unknown): data is LookRefusal {
  return (
    data instanceof Object &&
    "code" in data &&
    LOOK_REFUSAL_CODES.some((code) => code === data.code)
  );
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function lookNameProblem(name: string): "name" | null {
  const clean = cleanName(name);

  return clean.length === 0 || clean.length > MAX_NAME_LENGTH ? "name" : null;
}

function lookConfigProblem(config: LookConfig): "config" | null {
  const json = canonicalJson(config);

  return json === null ||
    new TextEncoder().encode(json).length > MAX_CONFIG_BYTES
    ? "config"
    : null;
}

/**
 * v.any() admits every Convex value, and JSON.stringify writes bytes as {}
 * and NaN as null.
 */
function canonicalJson(value: unknown): string | null {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map(canonicalJson);

    return items.includes(null) ? null : `[${items.join(",")}]`;
  }
  if (
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    const fields = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, inner]) => {
        const json = canonicalJson(inner);

        return json === null ? null : `${JSON.stringify(key)}:${json}`;
      });

    return fields.includes(null) ? null : `{${fields.join(",")}}`;
  }

  return null;
}

export type CreateInput = {
  readonly createKey: string;
  readonly name: string;
  readonly config: LookConfig;
};

export type CreatePlan =
  | { readonly kind: "existing"; readonly id: LookId }
  | { readonly kind: "insert"; readonly look: Infer<typeof lookValidator> }
  | { readonly kind: "refuse"; readonly code: "name" | "config" };

/**
 * What create does. A look already made with this createKey wins before any
 * check, so a retry returns the same id even if the look was renamed or
 * saved since. Otherwise it inserts the cleaned name and the config as sent.
 */
export function planCreate(
  existing: Look | null,
  input: CreateInput,
  now: number
): CreatePlan {
  if (existing) {
    return { kind: "existing", id: existing._id };
  }

  const problem =
    lookNameProblem(input.name) ?? lookConfigProblem(input.config);

  if (problem) {
    return { kind: "refuse", code: problem };
  }

  return {
    kind: "insert",
    look: {
      name: cleanName(input.name),
      config: input.config,
      version: 0,
      createKey: input.createKey,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export type SaveInput = {
  readonly baseVersion: number;
  readonly config: LookConfig;
};

export type SavePlan =
  | {
      readonly kind: "patch";
      readonly patch: {
        readonly config: LookConfig;
        readonly version: number;
        readonly updatedAt: number;
      };
    }
  | { readonly kind: "unchanged"; readonly version: number }
  | {
      readonly kind: "refuse";
      readonly code: "missing" | "config" | "stale";
    };

/**
 * A config that is already stored writes nothing, so a retry of a save that
 * landed succeeds with the version it made.
 */
export function planSave(
  look: Look | null,
  input: SaveInput,
  now: number
): SavePlan {
  if (!look) {
    return { kind: "refuse", code: "missing" };
  }

  const problem = lookConfigProblem(input.config);

  if (problem) {
    return { kind: "refuse", code: problem };
  }
  if (canonicalJson(input.config) === canonicalJson(look.config)) {
    return { kind: "unchanged", version: look.version };
  }
  if (input.baseVersion !== look.version) {
    return { kind: "refuse", code: "stale" };
  }

  return {
    kind: "patch",
    patch: { config: input.config, version: look.version + 1, updatedAt: now },
  };
}

export type RenamePlan =
  | {
      readonly kind: "patch";
      readonly patch: { readonly name: string; readonly updatedAt: number };
    }
  | { readonly kind: "refuse"; readonly code: "missing" | "name" };

export function planRename(
  look: Look | null,
  name: string,
  now: number
): RenamePlan {
  if (!look) {
    return { kind: "refuse", code: "missing" };
  }

  const problem = lookNameProblem(name);

  return problem
    ? { kind: "refuse", code: problem }
    : { kind: "patch", patch: { name: cleanName(name), updatedAt: now } };
}

/** What uses a look. Either use keeps it from being deleted. An AdminLook is one. */
export type LookUsage = {
  readonly live: boolean;
  readonly usedBy: readonly TrackRef[];
};

/** A look's usage from the site row and the tracks that name it. The one place live is worked out. */
export function lookUsage(
  look: Pick<Look, "_id">,
  site: Site | null,
  usedBy: readonly TrackRef[]
): LookUsage {
  return { live: site?.liveLook === look._id, usedBy };
}

/**
 * Why a look can't be deleted, or null. Live wins over used. remove()
 * refuses by it and the editor holds Delete by it, so both apply one rule.
 */
export function removeProblem(usage: LookUsage): "live" | "used" | null {
  if (usage.live) {
    return "live";
  }

  return usage.usedBy.length > 0 ? "used" : null;
}

export type RemovePlan =
  | { readonly kind: "gone" }
  | { readonly kind: "delete"; readonly id: LookId }
  | { readonly kind: "refuse"; readonly code: "live" | "used" };

/**
 * What remove does. A look that is already gone is a no-op, so a repeat
 * converges. Its refusals are the only guards that keep site.liveLook and
 * track.look from dangling. Convex runs mutations serializably, so no
 * setLook lands between the usage read and the delete.
 */
export function planRemove(look: Look | null, usage: LookUsage): RemovePlan {
  if (!look) {
    return { kind: "gone" };
  }

  const problem = removeProblem(usage);

  return problem
    ? { kind: "refuse", code: problem }
    : { kind: "delete", id: look._id };
}

export type SetLivePlan =
  | { readonly kind: "unchanged" }
  | { readonly kind: "insert"; readonly site: Infer<typeof siteValidator> }
  | {
      readonly kind: "patch";
      readonly id: Id<"site">;
      readonly site: Infer<typeof siteValidator>;
    }
  | { readonly kind: "refuse"; readonly code: "missing" };

/**
 * What setLive does. Pointing at the look that is already live writes
 * nothing, so a repeat leaves every open page's subscription alone.
 */
export function planSetLive(look: Look | null, site: Site | null): SetLivePlan {
  if (!look) {
    return { kind: "refuse", code: "missing" };
  }
  if (!site) {
    return { kind: "insert", site: { liveLook: look._id } };
  }

  return site.liveLook === look._id
    ? { kind: "unchanged" }
    : { kind: "patch", id: site._id, site: { liveLook: look._id } };
}

export function toAdminLook(look: Look, usage: LookUsage): AdminLook {
  return {
    id: look._id,
    name: look.name,
    config: look.config,
    version: look.version,
    live: usage.live,
    usedBy: [...usage.usedBy],
  };
}

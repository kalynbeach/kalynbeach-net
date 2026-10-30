/**
 * The looks editor's state and every rule it applies, as pure functions.
 * ./editor.tsx wires them to Convex and React.
 *
 * Each look keeps its own draft, so selecting another look never blocks or
 * loses edits. An edit that matches the stored look is not a draft: the
 * reducer drops it on the edit and whenever a new list arrives, so every
 * draft is unsaved. A draft turns stale when another tab saves a newer
 * version. It can't save until it is kept, which moves it onto that
 * version, or discarded.
 *
 * A Save pins its draft until it ends. The listed look is about to become
 * what the Save sent, so the draft keeps every edit, even one that matches
 * that look, and offers no Save, Keep, or Discard. When the Save lands, the
 * draft drops if it holds what was stored, else it moves onto the stored
 * version. When it fails or is refused, the draft stays for another try.
 * The preview keeps its object while its content holds (nextPreview), so
 * Save never resets the figure.
 *
 * The view carries each command with its arguments, or why it is off, so
 * the UI can't send a call the rules forbid. The server's refusals stay the
 * real guards.
 */
import { ConvexError } from "convex/values";
import {
  cleanName,
  isLookRefusal,
  lookNameProblem,
  MAX_NAME_LENGTH,
  removeProblem,
  type AdminLook,
  type LookId,
  type LookRefusalCode,
} from "@/convex/lib/looks";
import type {
  StoredValue,
  WaveformConfig,
} from "@/components/waveform/settings";
import { configKey, settle, type KeyedConfig } from "./look";

export type Draft = {
  readonly baseVersion: number;
  readonly config: WaveformConfig;
  /** The config a running Save sent, or null when none runs. */
  readonly saving: WaveformConfig | null;
};

export type EditorState = {
  /** The last list Convex delivered, or null before the first. */
  readonly looks: readonly AdminLook[] | null;
  /** null follows the live look, else the first look. */
  readonly selected: LookId | null;
  /**
   * Only listed looks. A draft differs from the stored look, except while
   * its Save runs; the Save's end restores that.
   */
  readonly drafts: ReadonlyMap<LookId, Draft>;
  /** create()'s idempotency key, replaced after each create resolves. */
  readonly createKey: string;
};

export function initialEditor(createKey: string): EditorState {
  return { looks: null, selected: null, drafts: new Map(), createKey };
}

export type EditorAction =
  | { readonly type: "listed"; readonly looks: readonly AdminLook[] }
  | { readonly type: "select"; readonly id: LookId }
  | {
      readonly type: "edit";
      readonly id: LookId;
      readonly config: WaveformConfig;
    }
  | { readonly type: "keep"; readonly id: LookId }
  | { readonly type: "discard"; readonly id: LookId }
  | {
      readonly type: "save";
      readonly id: LookId;
      readonly config: WaveformConfig;
    }
  | { readonly type: "saved"; readonly id: LookId; readonly version: number }
  /** The running Save failed or was refused; nothing was stored. */
  | { readonly type: "saveFailed"; readonly id: LookId }
  | {
      readonly type: "created";
      readonly id: LookId;
      readonly nextCreateKey: string;
    };

export function reduceEditor(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case "listed":
      return {
        ...state,
        looks: action.looks,
        drafts: new Map(
          action.looks.flatMap((look) => {
            const draft = state.drafts.get(look.id);

            return draft && stays(draft, look.config) ? [[look.id, draft]] : [];
          })
        ),
      };
    case "select":
      return { ...state, selected: action.id };
    case "edit": {
      const look = findLook(state, action.id);

      if (!look) return state;

      const draft = state.drafts.get(action.id);

      return setDraft(state, look.id, look.config, {
        baseVersion: draft?.baseVersion ?? look.version,
        config: action.config,
        saving: draft?.saving ?? null,
      });
    }
    case "keep": {
      const look = findLook(state, action.id);
      const draft = state.drafts.get(action.id);

      return look && draft && !draft.saving
        ? setDraft(state, look.id, look.config, {
            ...draft,
            baseVersion: look.version,
          })
        : state;
    }
    case "discard":
      return state.drafts.get(action.id)?.saving
        ? state
        : dropDraft(state, action.id);
    case "save": {
      const draft = state.drafts.get(action.id);

      return draft && !draft.saving
        ? putDraft(state, action.id, { ...draft, saving: action.config })
        : state;
    }
    case "saved": {
      const look = findLook(state, action.id);
      const draft = state.drafts.get(action.id);

      if (!look || !draft?.saving) return state;

      // Edits made while the Save ran sit on what it stored. A list that
      // already shows this version or a newer one drops a draft it matches,
      // as it would if it came second, so both orders end alike.
      const rebased: Draft = {
        baseVersion: action.version,
        config: draft.config,
        saving: null,
      };

      return stays(rebased, draft.saving) &&
        (look.version < action.version || stays(rebased, look.config))
        ? putDraft(state, look.id, rebased)
        : dropDraft(state, look.id);
    }
    case "saveFailed": {
      const look = findLook(state, action.id);
      const draft = state.drafts.get(action.id);

      return look && draft?.saving
        ? setDraft(state, look.id, look.config, { ...draft, saving: null })
        : state;
    }
    case "created":
      return {
        ...state,
        selected: action.id,
        createKey: action.nextCreateKey,
      };
  }
}

function findLook(state: EditorState, id: LookId): AdminLook | undefined {
  return state.looks?.find((look) => look.id === id);
}

/**
 * Whether a draft stays over this stored config: while its Save runs, or
 * while its content differs. The one rule every drop goes through.
 */
function stays(draft: Draft, stored: StoredValue): boolean {
  return draft.saving !== null || configKey(draft.config) !== configKey(stored);
}

function setDraft(
  state: EditorState,
  id: LookId,
  stored: StoredValue,
  draft: Draft
): EditorState {
  return stays(draft, stored)
    ? putDraft(state, id, draft)
    : dropDraft(state, id);
}

function putDraft(state: EditorState, id: LookId, draft: Draft): EditorState {
  return { ...state, drafts: new Map(state.drafts).set(id, draft) };
}

function dropDraft(state: EditorState, id: LookId): EditorState {
  const drafts = new Map(state.drafts);

  drafts.delete(id);

  return { ...state, drafts };
}

export const NEW_LOOK_NAME = "Untitled look";

export type LookRow = {
  readonly id: LookId;
  readonly name: string;
  readonly live: boolean;
  readonly unsaved: boolean;
  readonly selected: boolean;
};

export type UseOnSite =
  | { readonly kind: "ready"; readonly id: LookId }
  | { readonly kind: "live" }
  | { readonly kind: "unsaved" };

/** Delete's state. `held` carries the code remove() would refuse with, so its label is REFUSAL_LABELS[code]. */
export type Remove =
  | { readonly kind: "ready"; readonly id: LookId }
  | { readonly kind: "held"; readonly code: "live" | "used" };

export type Selection = {
  readonly look: AdminLook;
  readonly draft: WaveformConfig | null;
  readonly save: {
    readonly id: LookId;
    readonly baseVersion: number;
    readonly config: WaveformConfig;
  } | null;
  readonly discard: LookId | null;
  readonly keep: LookId | null;
  readonly useOnSite: UseOnSite;
  readonly remove: Remove;
};

export type EditorView = {
  readonly rows: readonly LookRow[];
  readonly selection: Selection | null;
  readonly anyUnsaved: boolean;
};

export function viewEditor(state: EditorState): EditorView {
  const looks = state.looks ?? [];
  const shown =
    looks.find((look) => look.id === state.selected) ??
    looks.find((look) => look.live) ??
    looks[0] ??
    null;

  return {
    rows: looks.map((look) => ({
      id: look.id,
      name: look.name,
      live: look.live,
      unsaved: state.drafts.has(look.id),
      selected: look.id === shown?.id,
    })),
    selection: shown && select(shown, state.drafts.get(shown.id) ?? null),
    anyUnsaved: state.drafts.size > 0,
  };
}

function select(look: AdminLook, draft: Draft | null): Selection {
  // While a Save runs, a newer listed version may be that Save's own, so
  // staleness waits for the Save to end, and so do Save, Keep, and Discard.
  const idle = draft !== null && draft.saving === null;
  const stale = idle && draft.baseVersion < look.version;
  const held = removeProblem(look);

  return {
    look,
    draft: draft?.config ?? null,
    save:
      idle && !stale
        ? { id: look.id, baseVersion: draft.baseVersion, config: draft.config }
        : null,
    discard: idle ? look.id : null,
    keep: stale ? look.id : null,
    useOnSite: look.live
      ? { kind: "live" }
      : draft
        ? { kind: "unsaved" }
        : { kind: "ready", id: look.id },
    remove: held
      ? { kind: "held", code: held }
      : { kind: "ready", id: look.id },
  };
}

/**
 * What the preview draws next: the draft object while there is one, else
 * the stored look, keeping the object already on screen while its content
 * holds. A dropped draft gives way to the stored look it was saved as
 * without a new object, so the engine doesn't reconfigure.
 */
export function nextPreview(
  shown: KeyedConfig,
  draft: WaveformConfig | null,
  stored: StoredValue
): KeyedConfig {
  if (draft === null) return settle(shown, stored);
  if (draft === shown.config) return shown;

  return { key: configKey(draft), config: draft };
}

export type Rename =
  | {
      readonly kind: "ready";
      readonly args: { readonly id: LookId; readonly name: string };
    }
  | { readonly kind: "unchanged" }
  | { readonly kind: "invalid" };

export function renameLook(look: AdminLook, input: string): Rename {
  if (lookNameProblem(input)) return { kind: "invalid" };
  if (cleanName(input) === look.name) return { kind: "unchanged" };

  return { kind: "ready", args: { id: look.id, name: input } };
}

export const REFUSAL_LABELS: { readonly [C in LookRefusalCode]: string } = {
  live: "The live look can't be deleted.",
  // Placeholder copy for Kalyn to write.
  used: "Tracks use this look.",
  missing: "This look no longer exists.",
  name: `A name needs 1 to ${MAX_NAME_LENGTH} characters.`,
  config: "This look is too large to save.",
  stale: "Another tab saved this look first.",
};

export const FAILURE_LABEL = "That didn't go through. Try again.";

export function failureLabel(error: unknown): string {
  return error instanceof ConvexError && isLookRefusal(error.data)
    ? REFUSAL_LABELS[error.data.code]
    : FAILURE_LABEL;
}

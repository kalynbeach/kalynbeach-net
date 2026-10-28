/**
 * The looks editor's state and every rule it applies, as pure functions.
 * ./editor.tsx wires them to Convex and React.
 *
 * Each look keeps its own draft, so selecting another look never blocks or
 * loses edits. A draft is unsaved while its content key differs from the
 * stored look's, so a slider dragged away and back reads as saved. A Save
 * drops its draft once it resolves, so a later save from another tab never
 * reads as an edit here. The preview keeps its object while its content
 * holds (nextPreview), so Save never resets the figure.
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
  type AdminLook,
  type LookId,
  type LookRefusalCode,
} from "@/convex/lib/looks";
import type {
  StoredValue,
  WaveformConfig,
} from "@/components/waveform/settings";
import { configKey, settle, type KeyedConfig } from "./look";

export type EditorState = {
  /** null follows the live look, else the first look. */
  readonly selected: LookId | null;
  readonly drafts: ReadonlyMap<LookId, WaveformConfig>;
  /** create()'s idempotency key, replaced after each create resolves. */
  readonly createKey: string;
};

export function initialEditor(createKey: string): EditorState {
  return { selected: null, drafts: new Map(), createKey };
}

export type EditorAction =
  | { readonly type: "select"; readonly id: LookId }
  | {
      readonly type: "edit";
      readonly id: LookId;
      readonly config: WaveformConfig;
    }
  | { readonly type: "discard"; readonly id: LookId }
  | {
      readonly type: "saved";
      readonly id: LookId;
      readonly config: WaveformConfig;
    }
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
    case "select":
      return { ...state, selected: action.id };
    case "edit":
      return {
        ...state,
        drafts: new Map(state.drafts).set(action.id, action.config),
      };
    case "discard": {
      const drafts = new Map(state.drafts);

      drafts.delete(action.id);

      return { ...state, drafts };
    }
    case "saved": {
      // Edits made while the Save ran are a new draft object, so they stay.
      if (state.drafts.get(action.id) !== action.config) return state;

      const drafts = new Map(state.drafts);

      drafts.delete(action.id);

      return { ...state, drafts };
    }
    case "created":
      return {
        ...state,
        selected: action.id,
        createKey: action.nextCreateKey,
      };
  }
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

export type Remove =
  | { readonly kind: "ready"; readonly id: LookId }
  | { readonly kind: "live" };

export type Selection = {
  readonly look: AdminLook;
  /** The draft to preview, unsaved or not, or null to preview the stored look. */
  readonly draft: WaveformConfig | null;
  readonly unsaved: boolean;
  readonly save: {
    readonly id: LookId;
    readonly config: WaveformConfig;
  } | null;
  readonly discard: LookId | null;
  readonly useOnSite: UseOnSite;
  readonly remove: Remove;
};

export type EditorView = {
  readonly rows: readonly LookRow[];
  readonly selection: Selection | null;
  readonly anyUnsaved: boolean;
};

/**
 * Everything the editor shows for one list of looks. A draft whose look is
 * gone, such as one deleted in another tab, drops out with it.
 */
export function viewEditor(
  state: EditorState,
  looks: readonly AdminLook[]
): EditorView {
  const shown =
    looks.find((look) => look.id === state.selected) ??
    looks.find((look) => look.live) ??
    looks[0] ??
    null;
  const rows = looks.map((look) => ({
    id: look.id,
    name: look.name,
    live: look.live,
    unsaved: isUnsaved(look, state.drafts.get(look.id)),
    selected: look.id === shown?.id,
  }));
  const shownRow = rows.find((row) => row.selected);

  return {
    rows,
    selection:
      shown &&
      select(
        shown,
        state.drafts.get(shown.id) ?? null,
        shownRow?.unsaved ?? false
      ),
    anyUnsaved: rows.some((row) => row.unsaved),
  };
}

function isUnsaved(look: AdminLook, draft: WaveformConfig | undefined) {
  return draft !== undefined && configKey(draft) !== configKey(look.config);
}

function select(
  look: AdminLook,
  draft: WaveformConfig | null,
  unsaved: boolean
): Selection {
  const save =
    draft !== null && unsaved ? { id: look.id, config: draft } : null;

  return {
    look,
    draft,
    unsaved,
    save,
    discard: unsaved ? look.id : null,
    useOnSite: look.live
      ? { kind: "live" }
      : unsaved
        ? { kind: "unsaved" }
        : { kind: "ready", id: look.id },
    remove: look.live ? { kind: "live" } : { kind: "ready", id: look.id },
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
  missing: "This look no longer exists.",
  name: `A name needs 1 to ${MAX_NAME_LENGTH} characters.`,
  config: "This look is too large to save.",
};

export const FAILURE_LABEL = "That didn't go through. Try again.";

export function failureLabel(error: unknown): string {
  return error instanceof ConvexError && isLookRefusal(error.data)
    ? REFUSAL_LABELS[error.data.code]
    : FAILURE_LABEL;
}

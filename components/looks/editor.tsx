"use client";

/**
 * The dashboard's looks editor. No props:
 *
 *   // app/(admin)/dashboard/page.tsx
 *   <LooksEditor />
 *
 * It renders blocks of section 1's body, so the shell spaces them like any
 * page's blocks: the looks, then the selected look's name and commands, its
 * preview, and WaveformPanel.
 *
 * The preview and the panel share the editor's own WaveformProvider with
 * no audio. It takes viewTransitionName={null}: on /dashboard the shell's
 * nav mark carries "waveform", and a repeated name stops every view
 * transition on the page. The nav mark keeps the shell's live look, so
 * "Use on site" visibly changes it here.
 */
import { useConvexAuth, useMutation, useQueries } from "convex/react";
import { useEffect, useReducer, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { AdminLook, LookId } from "@/convex/lib/looks";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Waveform, WaveformProvider } from "@/components/waveform/waveform";
import { WaveformPanel } from "@/components/waveform/panel";
import {
  DEFAULT_WAVEFORM_CONFIG,
  type Form,
  type WaveformConfig,
} from "@/components/waveform/settings";
import { toKeyedConfig } from "./look";
import {
  failureLabel,
  initialEditor,
  NEW_LOOK_NAME,
  nextPreview,
  reduceEditor,
  REFUSAL_LABELS,
  renameLook,
  viewEditor,
  type LookRow,
  type Selection,
} from "./model";

/** Module scope, so the request never changes and the subscription never restarts. */
const LIST = { list: { query: api.looks.list, args: {} } };

/**
 * Until Convex holds the Clerk token, an admin query is refused as
 * unauthenticated, so the list waits for it and shows its spinner.
 */
const NO_QUERIES = {};

/** The mutation in flight. Commands wait while one runs; selection never does. */
type Command = "create" | "save" | "rename" | "useOnSite" | "remove";

type Commands = {
  readonly edit: (id: LookId, config: WaveformConfig) => void;
  readonly save: (args: NonNullable<Selection["save"]>) => void;
  readonly keep: (id: LookId) => void;
  readonly discard: (id: LookId) => void;
  readonly rename: (args: { id: LookId; name: string }) => void;
  readonly useOnSite: (id: LookId) => void;
  readonly remove: (id: LookId) => void;
};

export function LooksEditor() {
  const { isAuthenticated } = useConvexAuth();
  const result: readonly AdminLook[] | Error | undefined = useQueries(
    isAuthenticated ? LIST : NO_QUERIES
  ).list;
  const [state, dispatch] = useReducer(reduceEditor, null, () =>
    initialEditor(crypto.randomUUID())
  );

  // A new list enters the reducer during render, React's pattern for state
  // derived from a changing input. useQueries gives undefined while it
  // resubscribes and an Error when the query throws; neither replaces the
  // list held, so a reconnect never unmounts the preview, and drafts
  // survive a failing query.
  if (Array.isArray(result) && result !== state.looks) {
    dispatch({ type: "listed", looks: result });
  }

  const view = viewEditor(state);
  const { selection } = view;
  const failed = result instanceof Error;
  const [pending, setPending] = useState<Command | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const create = useMutation(api.looks.create);
  const save = useMutation(api.looks.save);
  const rename = useMutation(api.looks.rename);
  const remove = useMutation(api.looks.remove);
  const setLive = useMutation(api.looks.setLive);

  useUnloadWarning(view.anyUnsaved);

  // A failure shows its label until the next command or selection.
  const run = async (command: Command, call: () => Promise<unknown>) => {
    setPending(command);
    setFailure(null);

    try {
      await call();
    } catch (error) {
      setFailure(failureLabel(error));
    } finally {
      setPending(null);
    }
  };

  const select = (id: LookId) => {
    setFailure(null);
    dispatch({ type: "select", id });
  };

  const newLook = () =>
    run("create", async () => {
      const id = await create({
        createKey: state.createKey,
        name: NEW_LOOK_NAME,
        config: DEFAULT_WAVEFORM_CONFIG,
      });

      dispatch({ type: "created", id, nextCreateKey: crypto.randomUUID() });
    });

  const commands: Commands = {
    edit: (id, config) => dispatch({ type: "edit", id, config }),
    save: (args) =>
      run("save", async () => {
        dispatch({ type: "save", id: args.id, config: args.config });

        try {
          const version = await save(args);

          dispatch({ type: "saved", id: args.id, version });
        } catch (error) {
          dispatch({ type: "saveFailed", id: args.id });
          throw error;
        }
      }),
    keep: (id) => {
      setFailure(null);
      dispatch({ type: "keep", id });
    },
    discard: (id) => {
      setFailure(null);
      dispatch({ type: "discard", id });
    },
    rename: (args) => run("rename", () => rename(args)),
    useOnSite: (id) => run("useOnSite", () => setLive({ id })),
    remove: (id) => run("remove", () => remove({ id })),
  };

  return (
    <>
      <section aria-label="Looks" className="flex flex-col">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="role-heading text-ramp-10">Looks</h2>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null || state.looks === null}
            onClick={newLook}
          >
            {pending === "create" && <Spinner />}
            New look
          </Button>
        </div>
        {failed && (
          <p role="alert" className="role-body text-destructive pt-3">
            {state.looks === null
              ? "Looks didn't load."
              : "Looks stopped updating. Unsaved edits are kept."}
          </p>
        )}
        {state.looks === null && !failed && (
          <div className="h-row text-ramp-6 flex items-center">
            <Spinner />
          </div>
        )}
        {state.looks !== null && (
          <LookList rows={view.rows} onSelect={select} />
        )}
        {!selection && failure && <Failure label={failure} />}
      </section>
      {selection && (
        <SelectedLook
          selection={selection}
          pending={pending}
          failure={failure}
          commands={commands}
        />
      )}
    </>
  );
}

/**
 * The selected look's controls, preview and panel around the editor's own
 * WaveformProvider. It mounts with the first selection, so the preview
 * starts from a real look.
 */
function SelectedLook({
  selection,
  pending,
  failure,
  commands,
}: {
  selection: Selection;
  pending: Command | null;
  failure: string | null;
  commands: Commands;
}) {
  const [shown, setShown] = useState(() =>
    toKeyedConfig(selection.look.config)
  );
  const preview = nextPreview(shown, selection.draft, selection.look.config);
  const [form, setForm] = useState<Form>("stage");

  if (preview !== shown) setShown(preview);

  return (
    <WaveformProvider
      config={preview.config}
      onConfigChange={(config) => commands.edit(selection.look.id, config)}
      viewTransitionName={null}
    >
      <LookControls
        key={`${selection.look.id}:${selection.look.name}`}
        selection={selection}
        pending={pending}
        failure={failure}
        commands={commands}
      />
      <Waveform
        form={form}
        className="aspect-square w-full max-w-80 self-center"
      />
      <WaveformPanel form={form} onFormChange={setForm} />
    </WaveformProvider>
  );
}

/** While any draft is unsaved, the browser asks before a reload or close. Client navigation still drops drafts. */
function useUnloadWarning(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
}

function LookList({
  rows,
  onSelect,
}: {
  rows: readonly LookRow[];
  onSelect: (id: LookId) => void;
}) {
  if (rows.length === 0) {
    return <p className="role-body text-ramp-7 pt-3">No looks yet.</p>;
  }

  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            aria-current={row.selected ? "true" : undefined}
            onClick={() => onSelect(row.id)}
            className={cn(
              "role-entry h-row flex w-full items-center gap-3 text-start pointer-coarse:h-11",
              row.selected ? "text-ramp-10" : "text-ramp-7 hover:text-ramp-9"
            )}
          >
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            {row.unsaved && (
              <span className="role-mono-sm text-ramp-6">Unsaved</span>
            )}
            {row.live && <Badge variant="success">Live</Badge>}
            <span
              aria-hidden
              className={cn(
                "size-1.25 shrink-0",
                row.selected && "bg-signal shadow-lit-dot"
              )}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The selected look's name and commands. Keyed by look id and stored name,
 * so the name field and a pending Delete confirmation start over with each
 * selection, and the field shows the cleaned name after a rename.
 */
function LookControls({
  selection,
  pending,
  failure,
  commands,
}: {
  selection: Selection;
  pending: Command | null;
  failure: string | null;
  commands: Commands;
}) {
  const { look, save, discard, keep, useOnSite, remove } = selection;
  const [name, setName] = useState(look.name);
  const [confirming, setConfirming] = useState(false);
  const rename = renameLook(look, name);
  const busy = pending !== null;

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rename.kind === "ready") commands.rename(rename.args);
  };

  return (
    <section aria-label="Selected look" className="flex flex-col gap-4">
      <form onSubmit={submitRename}>
        <Field invalid={rename.kind === "invalid"}>
          <FieldLabel>Name</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={rename.kind !== "ready" || busy}
            >
              {pending === "rename" && <Spinner />}
              Rename
            </Button>
          </div>
          {rename.kind === "invalid" && (
            <FieldError>{REFUSAL_LABELS.name}</FieldError>
          )}
        </Field>
      </form>
      {keep && (
        <div className="flex flex-wrap items-center gap-2">
          <span role="alert" className="role-body text-ramp-9">
            Saved in another tab since you started editing.
          </span>
          <Button variant="outline" onClick={() => commands.keep(keep)}>
            Keep my edits
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!save || busy}
          onClick={() => save && commands.save(save)}
        >
          {pending === "save" && <Spinner />}
          Save
        </Button>
        <Button
          variant="outline"
          disabled={!discard}
          onClick={() => discard && commands.discard(discard)}
        >
          Discard
        </Button>
        {useOnSite.kind === "live" ? (
          <Badge variant="success">Live</Badge>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={useOnSite.kind !== "ready" || busy}
              onClick={() =>
                useOnSite.kind === "ready" && commands.useOnSite(useOnSite.id)
              }
            >
              {pending === "useOnSite" && <Spinner />}
              Use on site
            </Button>
            {useOnSite.kind === "unsaved" && (
              <span className="role-mono-sm text-ramp-6">Save first</span>
            )}
          </>
        )}
      </div>
      {remove.kind === "live" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" disabled>
            Delete
          </Button>
          <span className="role-mono-sm text-ramp-6">
            {REFUSAL_LABELS.live}
          </span>
        </div>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="role-body text-ramp-9">Delete this look?</span>
          <Button
            variant="destructive"
            autoFocus
            disabled={busy}
            onClick={() => commands.remove(remove.id)}
          >
            {pending === "remove" && <Spinner />}
            Delete look
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </div>
      )}
      {failure && <Failure label={failure} />}
    </section>
  );
}

function Failure({ label }: { label: string }) {
  return (
    <p role="alert" className="role-body text-destructive">
      {label}
    </p>
  );
}

"use client";

/**
 * The dashboard's track manager: New track, then a table of every track
 * with its audio, its look, and Edit, Attach audio or Replace audio, and
 * Remove.
 *
 * Rules and derivations live in model.ts and work in flight in upload.ts;
 * these components draw a view and send commands. New track and each row own
 * one upload each, so no two writers share one. The site shell subscribes to
 * tracks.list, so every open tab's player follows each write.
 */
import {
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import {
  Authenticated,
  AuthLoading,
  useConvex,
  useMutation,
  useQueries,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AdminLook, LookId } from "@/convex/lib/looks";
import type {
  AdminTrack,
  MetadataProblem,
  TrackMetadata,
} from "@/convex/lib/tracks";
import { cn } from "@/lib/utils";
import { SectionHead } from "@/components/site/section-head";
import { formatClock, formatCount } from "@/components/wave-player/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  AUDIO_ACCEPT,
  checkMetadata,
  describeUpload,
  errorMessage,
  legacyFileName,
  metadataPatch,
  trackLookView,
  type UploadCommand,
  type UploadView,
  type WorkStep,
} from "./model";
import { browserUploadEnv, createAudioUpload } from "./upload";

type Send = (command: UploadCommand) => void;

/**
 * Admin queries and mutations need the Clerk token on the Convex socket.
 * The (admin) layout checked admin access on the server, but the browser's
 * client authenticates only after Clerk loads, so nothing below queries or
 * mutates until Convex confirms the token. Signed out, this draws nothing,
 * and SiteAuth above it offers sign-in.
 */
export function TracksDashboard() {
  return (
    <>
      <AuthLoading>
        <Spinner />
      </AuthLoading>
      <Authenticated>
        <section className="flex min-h-0 flex-1 flex-col">
          <SectionHead title="Tracks">
            <NewTrack />
          </SectionHead>
          <TrackTable />
        </section>
      </Authenticated>
    </>
  );
}

/**
 * Module scope, so useQueries sees one request object and subscribes once.
 * The looks editor asks for looks.list too, and Convex shares the
 * subscription.
 */
const DASHBOARD = {
  tracks: { query: api.tracks.adminList, args: {} },
  looks: { query: api.looks.list, args: {} },
};

/** looks.list as useQueries gives it: undefined while it loads, an Error when it fails. */
type Looks = readonly AdminLook[] | Error | undefined;

/** useQueries returns a failure as a value, where useQuery would throw it into the page. */
function TrackTable() {
  const result = useQueries(DASHBOARD);
  const tracks: AdminTrack[] | Error | undefined = result.tracks;
  const looks: Looks = result.looks;
  const lookHeader = useId();

  if (tracks === undefined) return <Spinner />;
  if (tracks instanceof Error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(tracks)}</AlertDescription>
      </Alert>
    );
  }
  if (tracks.length === 0) {
    return (
      <Empty>
        <EmptyDescription>No tracks.</EmptyDescription>
      </Empty>
    );
  }

  // At 1100px and up the frame's height ends here, so the table scrolls
  // inside it. The negative margin keeps focus rings clear of the clip.
  return (
    <div className="-m-1 min-h-0 overflow-auto p-1">
      <table className="w-full">
        {/* Placeholder copy for Kalyn to write: the column headers. */}
        <thead>
          <tr className="role-caps text-ramp-6 h-row">
            <th scope="col" className="w-10 pe-4 text-start font-normal">
              #
            </th>
            <th scope="col" className="pe-6 text-start font-normal">
              Track
            </th>
            <th scope="col" className="pe-6 text-start font-normal">
              Audio
            </th>
            <th
              scope="col"
              id={lookHeader}
              className="pe-6 text-start font-normal"
            >
              Look
            </th>
            <th scope="col" className="font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            looks={looks}
            lookHeader={lookHeader}
          />
        ))}
      </table>
    </div>
  );
}

const EMPTY_DRAFT: TrackMetadata = { title: "", artist: "", record: "" };

/**
 * The New track button and its dialog. The upload and the fields live here,
 * not in the dialog, so closing it never aborts an upload, and a line
 * beside the button follows the upload while the dialog is closed. After a
 * save the fields keep their values, since the next track usually shares
 * the artist and record, and Upload needs a new file.
 */
function NewTrack() {
  const [view, send] = useAudioUpload();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [problems, setProblems] = useState<readonly MetadataProblem[]>([]);
  const [open, setOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checked = checkMetadata(draft);

    setProblems(checked.ok ? [] : checked.problems);
    if (checked.ok) {
      send({ type: "start", save: { kind: "create", track: checked.track } });
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {!open && <UploadLine view={view} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button size="sm" className="pointer-coarse:h-11" />}
        >
          New track
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>New track</DialogTitle>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <FieldSet disabled={view.locked}>
              <MetadataFields
                draft={draft}
                problems={problems}
                onChange={setDraft}
              />
              <div className="flex">
                <AudioPicker
                  label="Choose file"
                  disabled={view.busy}
                  send={send}
                />
              </div>
            </FieldSet>
            {/* Outside the fieldset, so Cancel, Retry, and Dismiss stay on while it is disabled. */}
            <UploadStatus view={view} send={send} />
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>
                Close
              </DialogClose>
              <Button type="submit" disabled={!view.canStart}>
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** New track's upload in one line, while it runs or after it fails. */
function UploadLine({ view }: { view: UploadView }) {
  const { file, progress, failure } = view;

  if (file === null || (progress === null && failure === null)) return null;

  return (
    <p
      className={cn(
        "role-mono-sm flex min-w-0 gap-2",
        failure === null ? "text-ramp-7" : "text-destructive"
      )}
    >
      <span className="min-w-0 truncate">{file.name}</span>
      <span className="shrink-0">
        {progress === null
          ? failure
          : `${PROGRESS_LABELS[progress.step]}${progress.percent === null ? "" : ` ${progress.percent}%`}`}
      </span>
    </p>
  );
}

/**
 * One tbody per track: its row, then its upload's status and confirm step
 * in a full-width row while the upload holds a file. While the upload is
 * busy, Edit and Remove are off, so Remove can't race the row's own attach.
 */
function TrackRow({
  track,
  looks,
  lookHeader,
}: {
  track: AdminTrack;
  looks: Looks;
  /** The Look column header's id, half of the look select's name. */
  lookHeader: string;
}) {
  const [view, send] = useAudioUpload();
  const title = useId();
  const { audio } = track;
  const legacy = audio.kind === "legacy";

  return (
    <tbody>
      <tr className="border-ramp-4 border-t">
        <td className="role-readout text-ramp-6 py-3 pe-4 align-top">
          {formatCount(track.id)}
        </td>
        <th scope="row" className="py-3 pe-6 text-start font-normal">
          <span id={title} className="role-entry text-ramp-9 block">
            {track.title}
          </span>
          <span className="role-meta text-ramp-6 block">
            {[track.artist, track.record].filter(Boolean).join(" · ")}
          </span>
        </th>
        <td className="py-3 pe-6">
          <span className="flex items-center gap-2 whitespace-nowrap">
            {audio.kind === "legacy" ? (
              <>
                <Badge variant="outline">Legacy</Badge>
                <span className="role-mono-sm text-ramp-6">
                  {legacyFileName(audio.src)}
                </span>
              </>
            ) : (
              <>
                {audio.src === null && (
                  <Badge variant="destructive">Missing</Badge>
                )}
                <span className="role-readout text-ramp-7">
                  {formatClock(audio.duration)}
                </span>
              </>
            )}
          </span>
        </td>
        <td className="py-3 pe-6">
          <TrackLook
            track={track}
            looks={looks}
            labelledBy={`${lookHeader} ${title}`}
          />
        </td>
        <td className="py-3">
          <div className="flex justify-end gap-2">
            <EditTrack track={track} disabled={view.busy} />
            <AudioPicker
              label={legacy ? "Attach audio" : "Replace audio"}
              disabled={view.busy}
              send={send}
            />
            <RemoveTrack track={track} disabled={view.busy} />
          </div>
        </td>
      </tr>
      {view.file !== null && (
        <tr>
          <td colSpan={5} className="ps-10 pb-3">
            <div className="flex flex-col gap-3">
              <UploadStatus view={view} send={send} />
              {view.canStart && (
                // The confirm step: the row shows the picked file and its
                // length before attachAudio drops the legacy src or deletes
                // the old blob.
                <div className="flex gap-2">
                  <Button
                    className="pointer-coarse:h-11"
                    onClick={() =>
                      send({
                        type: "start",
                        save: { kind: "attach", id: track.id },
                      })
                    }
                  >
                    {legacy ? "Attach" : "Replace"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="pointer-coarse:h-11"
                    onClick={() => send({ type: "clear" })}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

/**
 * The pick shows while setLook runs. Convex resolves a mutation only after
 * adminList reflects it, so when the transition ends the stored look is
 * the pick, and after a refusal it is the look from before.
 */
function TrackLook({
  track,
  looks,
  labelledBy,
}: {
  track: AdminTrack;
  looks: Looks;
  labelledBy: string;
}) {
  const setLook = useMutation(api.tracks.setLook);
  const [chosen, setChosen] = useOptimistic(track.look);
  const [, startPicking] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const view = trackLookView(chosen, looks);

  if (view.kind === "failed") {
    return <p className="role-body text-destructive">{"Looks didn't load."}</p>;
  }

  function pick(look: LookId | null) {
    setFailure(null);
    startPicking(async () => {
      setChosen(look);
      try {
        await setLook({ id: track.id, look });
      } catch (error) {
        setFailure(errorMessage(error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={view.kind === "ready" ? view.value : null}
        disabled={view.kind === "loading"}
        onValueChange={pick}
      >
        <SelectTrigger
          aria-labelledby={labelledBy}
          className="w-44 pointer-coarse:h-11"
        >
          <SelectValue>
            {view.kind === "ready" ? view.label : <Spinner />}
          </SelectValue>
        </SelectTrigger>
        {view.kind === "ready" && (
          <SelectContent>
            {view.options.map((option) => (
              <SelectItem key={option.value ?? "default"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        )}
      </Select>
      <FieldError>{failure}</FieldError>
    </div>
  );
}

/**
 * The native input holds no state: its value resets on every change, so
 * picking the same file again still fires, and the upload is the only
 * record of what was picked.
 */
function AudioPicker({
  label,
  disabled,
  send,
}: {
  label: string;
  disabled: boolean;
  send: Send;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={AUDIO_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";
          if (file) send({ type: "pick", file });
        }}
      />
      <Button
        variant="secondary"
        disabled={disabled}
        className="pointer-coarse:h-11"
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}

const PROGRESS_LABELS = {
  reading: "Reading",
  uploading: "Uploading",
  saving: "Saving",
} as const satisfies Record<WorkStep["step"], string>;

/**
 * Cancel sits next to the bar, not inside it, because a progressbar's
 * children are presentational and assistive tech may not expose a button
 * there.
 */
function UploadStatus({ view, send }: { view: UploadView; send: Send }) {
  const { file, progress } = view;

  if (file === null) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="role-mono-sm text-ramp-7 flex gap-2">
        <span className="min-w-0 break-all">{file.name}</span>
        {file.duration !== null && (
          <span className="role-readout">{formatClock(file.duration)}</span>
        )}
      </p>
      <FieldError>{view.rejection}</FieldError>
      {progress && (
        <div className="flex items-end gap-3">
          <Progress value={progress.percent} className="flex-1">
            <ProgressLabel>{PROGRESS_LABELS[progress.step]}</ProgressLabel>
            {progress.percent !== null && <ProgressValue />}
          </Progress>
          {view.cancellable && (
            <Button
              size="xs"
              variant="secondary"
              className="pointer-coarse:h-11"
              onClick={() => send({ type: "clear" })}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
      {view.failure && (
        <Alert variant="destructive">
          <AlertDescription>{view.failure}</AlertDescription>
          <div className="flex gap-2 pt-1.5">
            <Button
              size="xs"
              className="pointer-coarse:h-11"
              onClick={() => send({ type: "retry" })}
            >
              Retry
            </Button>
            <Button
              size="xs"
              variant="secondary"
              className="pointer-coarse:h-11"
              onClick={() => send({ type: "clear" })}
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      )}
      {view.saved && (
        <p role="status" className="role-mono-sm text-ramp-7">
          Saved
        </p>
      )}
    </div>
  );
}

const FIELD_LABELS = [
  ["title", "Title"],
  ["artist", "Artist"],
  ["record", "Record"],
] as const;

function MetadataFields({
  draft,
  problems,
  onChange,
}: {
  draft: TrackMetadata;
  problems: readonly MetadataProblem[];
  onChange: (next: TrackMetadata) => void;
}) {
  return (
    <FieldGroup>
      {FIELD_LABELS.map(([name, label]) => {
        const errors = problems.filter((problem) => problem.field === name);

        return (
          <Field key={name} data-invalid={errors.length > 0 || undefined}>
            <FieldLabel>{label}</FieldLabel>
            <Input
              name={name}
              value={draft[name]}
              aria-invalid={errors.length > 0 || undefined}
              onChange={(event) =>
                onChange({ ...draft, [name]: event.currentTarget.value })
              }
            />
            <FieldError errors={errors} />
          </Field>
        );
      })}
    </FieldGroup>
  );
}

/**
 * EditForm mounts when the dialog opens and takes the draft and its base
 * then, so a live update from another tab doesn't reset what Kalyn typed.
 */
function EditTrack({
  track,
  disabled,
}: {
  track: AdminTrack;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            disabled={disabled}
            className="pointer-coarse:h-11"
          />
        }
      >
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Edit track</DialogTitle>
        {open && <EditForm track={track} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  track,
  onDone,
}: {
  track: AdminTrack;
  onDone: () => void;
}) {
  const update = useMutation(api.tracks.update);
  const [base] = useState<TrackMetadata>(() => ({
    title: track.title,
    artist: track.artist,
    record: track.record,
  }));
  const [draft, setDraft] = useState(base);
  const [problems, setProblems] = useState<readonly MetadataProblem[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checked = checkMetadata(draft);

    setProblems(checked.ok ? [] : checked.problems);
    if (!checked.ok) return;

    const patch = metadataPatch(base, checked.track);

    if (patch === null) return onDone();

    startSaving(async () => {
      try {
        await update({ id: track.id, track: patch });
        onDone();
      } catch (error) {
        setFailure(errorMessage(error));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldSet disabled={saving}>
        <MetadataFields draft={draft} problems={problems} onChange={setDraft} />
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Close
          </DialogClose>
          <Button type="submit">{saving ? <Spinner /> : "Save"}</Button>
        </DialogFooter>
      </FieldSet>
    </form>
  );
}

/**
 * remove is a no-op for a track already gone, so a second click or a second
 * tab is harmless.
 */
function RemoveTrack({
  track,
  disabled,
}: {
  track: AdminTrack;
  disabled: boolean;
}) {
  const remove = useMutation(api.tracks.remove);
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();

  function confirm() {
    startRemoving(async () => {
      try {
        await remove({ id: track.id });
        setOpen(false);
      } catch (error) {
        setFailure(errorMessage(error));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setFailure(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            disabled={disabled}
            className="pointer-coarse:h-11"
          />
        }
      >
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Remove {track.title}?</DialogTitle>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Close
          </DialogClose>
          <Button variant="destructive" disabled={removing} onClick={confirm}>
            {removing ? <Spinner /> : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The store lives as long as the component, and unmounting releases it,
 * which aborts a read or an upload in flight and discards the blob of a
 * save that fails with no one left to retry it.
 */
function useAudioUpload(): readonly [UploadView, Send] {
  const convex = useConvex();
  const [upload] = useState(() => createAudioUpload(browserUploadEnv(convex)));

  useEffect(() => upload.hold(), [upload]);

  const state = useSyncExternalStore(
    upload.subscribe,
    upload.getSnapshot,
    upload.getSnapshot
  );

  return [describeUpload(state), upload.send];
}

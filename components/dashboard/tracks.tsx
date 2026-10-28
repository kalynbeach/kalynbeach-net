"use client";

/**
 * The dashboard's track manager: a New track form, then every track with
 * Edit, Attach audio or Replace audio, and Remove.
 *
 * Rules and derivations live in model.ts and work in flight in upload.ts;
 * these components draw a view and send commands. The form and each row own
 * one upload each, so no two writers share one. Every write ends with
 * router.refresh(), so the root layout reads the new list and this tab's
 * player plays it.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Authenticated,
  AuthLoading,
  useConvex,
  useMutation,
  useQueries,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type {
  AdminTrack,
  MetadataProblem,
  TrackMetadata,
} from "@/convex/lib/tracks";
import { formatClock, formatCount } from "@/components/wave-player/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { Spinner } from "@/components/ui/spinner";
import {
  AUDIO_ACCEPT,
  checkMetadata,
  describeUpload,
  errorMessage,
  legacyFileName,
  metadataPatch,
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
        <section>
          <h2 className="role-heading text-ramp-10">New track</h2>
          <NewTrack />
        </section>
        <section>
          <h2 className="role-heading text-ramp-10">Tracks</h2>
          <TrackList />
        </section>
      </Authenticated>
    </>
  );
}

/** Module scope, so useQueries sees one request object and subscribes once. */
const ADMIN_LIST = { tracks: { query: api.tracks.adminList, args: {} } };

/** useQueries returns a failure as a value, where useQuery would throw it into the page. */
function TrackList() {
  const tracks: AdminTrack[] | Error | undefined =
    useQueries(ADMIN_LIST).tracks;

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

  return (
    <ol>
      {tracks.map((track) => (
        <TrackRow key={track.id} track={track} />
      ))}
    </ol>
  );
}

const EMPTY_DRAFT: TrackMetadata = { title: "", artist: "", record: "" };

/**
 * After a save the fields keep their values, since the next track usually
 * shares the artist and record, and Upload needs a new file.
 */
function NewTrack() {
  const [view, send] = useAudioUpload();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [problems, setProblems] = useState<readonly MetadataProblem[]>([]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checked = checkMetadata(draft);

    setProblems(checked.ok ? [] : checked.problems);
    if (checked.ok) {
      send({ type: "start", save: { kind: "create", track: checked.track } });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-3">
      <FieldSet disabled={view.locked}>
        <MetadataFields draft={draft} problems={problems} onChange={setDraft} />
        <div className="flex gap-2">
          <AudioPicker label="Choose file" disabled={view.busy} send={send} />
          <Button type="submit" disabled={!view.canStart}>
            Upload
          </Button>
        </div>
      </FieldSet>
      {/* Outside the fieldset, so Cancel, Retry, and Dismiss stay on while it is disabled. */}
      <UploadStatus view={view} send={send} />
    </form>
  );
}

/**
 * While the row's upload is busy, Edit and Remove are off, so Remove can't
 * race the row's own attach.
 */
function TrackRow({ track }: { track: AdminTrack }) {
  const [view, send] = useAudioUpload();
  const { audio } = track;
  const legacy = audio.kind === "legacy";

  return (
    <li className="border-ramp-4 flex flex-col gap-3 border-b py-3">
      <div className="flex items-start gap-3">
        <span className="role-readout text-ramp-6 pt-0.5">
          {formatCount(track.id)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="role-entry text-ramp-9">{track.title}</span>
          <span className="role-meta text-ramp-6">
            {[track.artist, track.record].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-2">
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
      </div>
      <div className="flex flex-wrap gap-2">
        <EditTrack track={track} disabled={view.busy} />
        <AudioPicker
          label={legacy ? "Attach audio" : "Replace audio"}
          disabled={view.busy}
          send={send}
        />
        <RemoveTrack track={track} disabled={view.busy} />
      </div>
      <UploadStatus view={view} send={send} />
      {view.canStart && (
        // The confirm step: the row shows the picked file and its length
        // before attachAudio drops the legacy src or deletes the old blob.
        <div className="flex gap-2">
          <Button
            onClick={() =>
              send({ type: "start", save: { kind: "attach", id: track.id } })
            }
          >
            {legacy ? "Attach" : "Replace"}
          </Button>
          <Button variant="ghost" onClick={() => send({ type: "clear" })}>
            Cancel
          </Button>
        </div>
      )}
    </li>
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
        variant="outline"
        disabled={disabled}
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
              variant="ghost"
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
            <Button size="xs" onClick={() => send({ type: "retry" })}>
              Retry
            </Button>
            <Button
              size="xs"
              variant="ghost"
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
      <DialogTrigger render={<Button variant="ghost" disabled={disabled} />}>
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
  const router = useRouter();
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
        router.refresh();
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
        <DialogFooter showCloseButton>
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();

  function confirm() {
    startRemoving(async () => {
      try {
        await remove({ id: track.id });
        router.refresh();
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
      <DialogTrigger render={<Button variant="ghost" disabled={disabled} />}>
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Remove {track.title}?</DialogTitle>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
        <DialogFooter showCloseButton>
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
 * which aborts a read or an upload in flight.
 */
function useAudioUpload(): readonly [UploadView, Send] {
  const convex = useConvex();
  const router = useRouter();
  const [upload] = useState(() =>
    createAudioUpload(browserUploadEnv(convex, () => router.refresh()))
  );

  useEffect(() => upload.release, [upload]);

  const state = useSyncExternalStore(
    upload.subscribe,
    upload.getSnapshot,
    upload.getSnapshot
  );

  return [describeUpload(state), upload.send];
}

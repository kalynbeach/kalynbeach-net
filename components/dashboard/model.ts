/**
 * The dashboard's decisions, with no I/O: the upload machine, what the UI
 * draws for an upload, the fields an edit sends, and the line a failure
 * shows. The rules are the server's own, from convex/lib/tracks.ts:
 * audioFileProblem on pick, trackAudioProblem after the read, and
 * trackMetadataProblems before create and update.
 */
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AUDIO_CONTENT_TYPES,
  audioFileProblem,
  trackAudioProblem,
  trackMetadataProblems,
  type MetadataProblem,
  type TrackMetadata,
} from "@/convex/lib/tracks";
import type { Seconds } from "@/lib/audio";

/** The file input's `accept`, derived so the allowlist has one home. */
export const AUDIO_ACCEPT = [...AUDIO_CONTENT_TYPES].join(",");

const METADATA_FIELDS = ["title", "artist", "record"] as const;

declare const checked: unique symbol;

/**
 * Trimmed metadata that passed trackMetadataProblems. Only checkMetadata
 * makes one, so neither an upload nor an edit can send unchecked fields.
 */
export type CheckedMetadata = TrackMetadata & { readonly [checked]: true };

export type MetadataCheck =
  | { readonly ok: true; readonly track: CheckedMetadata }
  | { readonly ok: false; readonly problems: readonly MetadataProblem[] };

/** Trims what the inputs hold, then applies the server's rule. */
export function checkMetadata(draft: TrackMetadata): MetadataCheck {
  const track = {
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    record: draft.record.trim(),
  };
  const problems = trackMetadataProblems(track);

  if (problems.length > 0) return { ok: false, problems };

  // SAFETY: trimmed and passed trackMetadataProblems, which is all CheckedMetadata claims.
  return { ok: true, track: track as CheckedMetadata };
}

/**
 * The fields an edit changed, or null when it changed none, so Save closes
 * without a call. `base` is the track as the dialog opened on it. Sending
 * only the changed fields keeps another tab's edit to a different field.
 */
export function metadataPatch(
  base: TrackMetadata,
  next: CheckedMetadata
): Partial<TrackMetadata> | null {
  const patch: Partial<TrackMetadata> = {};

  for (const field of METADATA_FIELDS) {
    if (next[field] !== base[field]) patch[field] = next[field];
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/** The S3 file a legacy row names, so Kalyn knows which file to upload again: ".../loops/0_initializer.wav" is "0_initializer.wav". */
export function legacyFileName(src: string): string {
  return src.slice(src.lastIndexOf("/") + 1);
}

/**
 * Peaks at 3 decimals, the precision the seed stores. Every document carries
 * every stored track's peaks, so the dashboard keeps each one short.
 */
export function roundPeaks(peaks: readonly number[]): readonly number[] {
  return peaks.map((peak) => Math.round(peak * 1000) / 1000);
}

/** A failure written for the admin: a file the browser can't read, or an upload Convex refused. */
export class AudioProblem extends Error {
  override name = "AudioProblem";
}

/** What the dashboard shows for a failure not written for the admin. */
export const REQUEST_FAILED = "Request failed";

/**
 * The line the dashboard shows for a thrown value: a ConvexError's string
 * data, an AudioProblem's message, or REQUEST_FAILED. Production Convex turns
 * a plain server Error into "Server Error", and a browser exception isn't
 * written for anyone, so those go to the console instead.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (error instanceof AudioProblem) return error.message;

  console.error(error);

  return REQUEST_FAILED;
}

/**
 * Convex's upload reply, 200 with `{ "storageId": string }`. Any other
 * status or shape is an AudioProblem.
 */
export function parseUploadResponse(
  status: number,
  body: string
): Id<"_storage"> {
  if (status !== 200) throw new AudioProblem(`Upload failed (HTTP ${status})`);

  let reply: unknown;

  try {
    reply = JSON.parse(body);
  } catch {
    reply = null;
  }

  if (
    typeof reply === "object" &&
    reply !== null &&
    "storageId" in reply &&
    typeof reply.storageId === "string"
  ) {
    // SAFETY: Convex answers a 200 upload with the new blob's storage id.
    return reply.storageId as Id<"_storage">;
  }

  throw new AudioProblem("Upload failed: Convex sent no storage id");
}

/** What create and attachAudio need besides the blob, from the block's own loaders, so the stored numbers match what the player measures. */
export type DecodedAudio = {
  readonly duration: Seconds;
  readonly peaks: readonly number[];
};

/** Where a finished upload goes. attach covers both attaching to a legacy track and replacing, as attachAudio does. */
export type AudioSave =
  | { readonly kind: "create"; readonly track: CheckedMetadata }
  | { readonly kind: "attach"; readonly id: number };

/**
 * One file on its way to a track. Each step holds exactly what the next
 * step needs, so "retry the save without uploading again" is the type of
 * failed at "save", not a flag. `run` names the step under way; it changes
 * whenever a step starts or the admin clears, and a step's result applies
 * only while its run is current.
 */
export type UploadState =
  | { readonly step: "empty"; readonly run: number }
  | { readonly step: "reading"; readonly run: number; readonly file: File }
  | {
      readonly step: "ready";
      readonly run: number;
      readonly file: File;
      readonly audio: DecodedAudio;
    }
  | {
      readonly step: "uploading";
      readonly run: number;
      readonly file: File;
      readonly audio: DecodedAudio;
      readonly save: AudioSave;
      /** Bytes sent of file.size. */
      readonly sent: number;
    }
  | {
      readonly step: "saving";
      readonly run: number;
      readonly file: File;
      readonly audio: DecodedAudio;
      readonly save: AudioSave;
      readonly storageId: Id<"_storage">;
    }
  | { readonly step: "saved"; readonly run: number; readonly file: File }
  | {
      /** The file can't be used. Picking another file is the only way on. */
      readonly step: "rejected";
      readonly run: number;
      readonly file: File;
      readonly message: string;
    }
  | {
      /** The upload failed. Retry uploads the same file again. */
      readonly step: "failed";
      readonly run: number;
      readonly file: File;
      readonly audio: DecodedAudio;
      readonly save: AudioSave;
      readonly at: "upload";
      readonly message: string;
    }
  | {
      /** The save failed after the blob landed. Retry saves the same blob, which create and attachAudio treat as a retry. */
      readonly step: "failed";
      readonly run: number;
      readonly file: File;
      readonly audio: DecodedAudio;
      readonly save: AudioSave;
      readonly at: "save";
      readonly storageId: Id<"_storage">;
      readonly message: string;
    };

/** What the admin does. */
export type UploadCommand =
  | { readonly type: "pick"; readonly file: File }
  | { readonly type: "start"; readonly save: AudioSave }
  | { readonly type: "retry" }
  | { readonly type: "clear" };

/** What a step reports, tagged with the run that started it. */
export type StepResult =
  | {
      readonly type: "read";
      readonly run: number;
      readonly audio: DecodedAudio;
    }
  | { readonly type: "progress"; readonly run: number; readonly sent: number }
  | {
      readonly type: "uploaded";
      readonly run: number;
      readonly storageId: Id<"_storage">;
    }
  | { readonly type: "saved"; readonly run: number }
  | { readonly type: "failed"; readonly run: number; readonly message: string };

export type UploadEvent = UploadCommand | StepResult;

export const EMPTY_UPLOAD: UploadState = { step: "empty", run: 0 };

/** The steps whose work the store starts when the machine enters them. */
export type WorkStep = Extract<
  UploadState,
  { step: "reading" | "uploading" | "saving" }
>;

/**
 * The upload machine. Pure. It returns the same object when the event does
 * not apply, so a stale result, a double click, and a retry in the wrong
 * step change nothing, and the store relies on that identity.
 *
 *   from                     event      to                              run
 *   not uploading, saving    pick(f)    reading, or rejected when        +1
 *                                       audioFileProblem refuses f
 *   reading                  read(a)    ready, or rejected when
 *                                       trackAudioProblem refuses a
 *   reading                  failed     rejected
 *   ready                    start(s)   uploading, sent 0                +1
 *   uploading                progress   uploading, sent never decreasing
 *   uploading                uploaded   saving                           +1
 *   uploading                failed     failed at upload
 *   saving                   saved      saved
 *   saving                   failed     failed at save, with storageId
 *   failed at upload         retry      uploading, sent 0                +1
 *   failed at save           retry      saving, same storageId           +1
 *   not empty, saving        clear      empty                            +1
 *   anything else, or a result whose run is stale: the same object
 *
 * saving refuses pick and clear: a mutation can't be recalled, and its
 * result must land on the state that started it.
 */
export function advance(state: UploadState, event: UploadEvent): UploadState {
  if ("run" in event && event.run !== state.run) return state;

  const run = state.run + 1;

  switch (event.type) {
    case "pick": {
      if (state.step === "uploading" || state.step === "saving") return state;

      const { file } = event;
      const problem = audioFileProblem({
        contentType: file.type,
        size: file.size,
      });

      return problem === null
        ? { step: "reading", run, file }
        : { step: "rejected", run, file, message: problem };
    }
    case "read": {
      if (state.step !== "reading") return state;

      const problem = trackAudioProblem(event.audio);

      return problem === null
        ? { ...state, step: "ready", audio: event.audio }
        : { ...state, step: "rejected", message: problem };
    }
    case "start":
      return state.step === "ready"
        ? { ...state, step: "uploading", run, save: event.save, sent: 0 }
        : state;
    case "progress":
      return state.step === "uploading" && event.sent > state.sent
        ? { ...state, sent: event.sent }
        : state;
    case "uploaded":
      return state.step === "uploading"
        ? {
            step: "saving",
            run,
            file: state.file,
            audio: state.audio,
            save: state.save,
            storageId: event.storageId,
          }
        : state;
    case "saved":
      return state.step === "saving"
        ? { step: "saved", run: state.run, file: state.file }
        : state;
    case "failed":
      switch (state.step) {
        case "reading":
          return { ...state, step: "rejected", message: event.message };
        case "uploading":
          return {
            step: "failed",
            run: state.run,
            file: state.file,
            audio: state.audio,
            save: state.save,
            at: "upload",
            message: event.message,
          };
        case "saving":
          return {
            ...state,
            step: "failed",
            at: "save",
            message: event.message,
          };
        default:
          return state;
      }
    case "retry":
      if (state.step !== "failed") return state;

      return state.at === "upload"
        ? {
            step: "uploading",
            run,
            file: state.file,
            audio: state.audio,
            save: state.save,
            sent: 0,
          }
        : {
            step: "saving",
            run,
            file: state.file,
            audio: state.audio,
            save: state.save,
            storageId: state.storageId,
          };
    case "clear":
      return state.step === "empty" || state.step === "saving"
        ? state
        : { step: "empty", run };
  }
}

/**
 * The blob a transition gives up: leaving a failed save any way but Retry
 * drops a storageId no track may hold, so the store asks the server to
 * discard it.
 */
export function abandonedUpload(
  from: UploadState,
  to: UploadState
): Id<"_storage"> | null {
  return from.step === "failed" && from.at === "save" && to.step !== "saving"
    ? from.storageId
    : null;
}

/** An upload as the dashboard draws it. Components read only this, never UploadState. */
export type UploadView = {
  /** The picked file, with its length once read. */
  readonly file: {
    readonly name: string;
    readonly duration: Seconds | null;
  } | null;
  /** A step under way. percent is null (indeterminate) while reading and saving, 0 to 100 while uploading. */
  readonly progress: {
    readonly step: WorkStep["step"];
    readonly percent: number | null;
  } | null;
  /** Reading or uploading, which Cancel aborts. A save can't be recalled. */
  readonly cancellable: boolean;
  /** This file can't be used. */
  readonly rejection: string | null;
  /** The upload or the save failed, and Retry resumes it. */
  readonly failure: string | null;
  /** Uploading or saving. The picker, the form, and the row's Edit and Remove are off. */
  readonly busy: boolean;
  /**
   * The upload holds what it will save, from Upload until it is saved or
   * dismissed, so the New track fields stay off: Retry sends the metadata
   * as it was at Upload.
   */
  readonly locked: boolean;
  /** Read and checked, so Upload, Attach, or Replace is on. */
  readonly canStart: boolean;
  readonly saved: boolean;
};

export function describeUpload(state: UploadState): UploadView {
  return {
    file:
      state.step === "empty"
        ? null
        : {
            name: state.file.name,
            duration: "audio" in state ? state.audio.duration : null,
          },
    progress:
      state.step === "uploading"
        ? {
            step: state.step,
            percent: Math.min(
              100,
              Math.floor((state.sent / state.file.size) * 100)
            ),
          }
        : state.step === "reading" || state.step === "saving"
          ? { step: state.step, percent: null }
          : null,
    cancellable: state.step === "reading" || state.step === "uploading",
    rejection: state.step === "rejected" ? state.message : null,
    failure: state.step === "failed" ? state.message : null,
    busy: state.step === "uploading" || state.step === "saving",
    locked:
      state.step === "uploading" ||
      state.step === "saving" ||
      state.step === "failed",
    canStart: state.step === "ready",
    saved: state.step === "saved",
  };
}

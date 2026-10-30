import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

const trackFields = {
  publicId: v.number(),
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

/**
 * Audio in Convex file storage. `duration` (seconds) and `peaks` (0 to 1)
 * describe this blob, so the WavePlayer never downloads a track to draw it.
 */
export const trackAudioValidator = v.object({
  storageId: v.id("_storage"),
  duration: v.number(),
  peaks: v.array(v.number()),
});

/**
 * A production track from before Convex storage, field for field. No
 * function creates one or serves its `src`; attachAudio converts it. Delete
 * this branch once no legacy track remains, and Convex refuses that schema
 * push while one does.
 */
const legacyTrackValidator = v.object({
  ...trackFields,
  src: v.string(),
  image: v.object({ src: v.string(), alt: v.string() }),
  isLoop: v.boolean(),
});

const storedTrackValidator = v.object({
  ...trackFields,
  audio: trackAudioValidator,
});

/** Object validators reject unknown fields, so a track has `src` or `audio`, never both or neither. */
export const trackValidator = v.union(
  legacyTrackValidator,
  storedTrackValidator
);

export const trackMetadataValidator = v.object({
  title: v.string(),
  artist: v.string(),
  record: v.string(),
});

/** The WavePlayer block's track input. `id` is the publicId as a string. */
export const publicTrackValidator = v.object({
  id: v.string(),
  title: v.string(),
  src: v.string(),
  artist: v.string(),
  record: v.string(),
  duration: v.number(),
  peaks: v.array(v.number()),
});

/** A dashboard row. A legacy row's `src` names the S3 file to upload again. */
export const adminTrackValidator = v.object({
  id: v.number(),
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  audio: v.union(
    v.object({ kind: v.literal("legacy"), src: v.string() }),
    v.object({
      kind: v.literal("stored"),
      src: v.union(v.string(), v.null()),
      duration: v.number(),
    })
  ),
});

export type TrackAudio = Infer<typeof trackAudioValidator>;
export type TrackMetadata = Infer<typeof trackMetadataValidator>;
export type LegacyTrack = Infer<typeof legacyTrackValidator>;
export type StoredTrack = Infer<typeof storedTrackValidator>;
export type Track = LegacyTrack | StoredTrack;
export type PublicTrack = Infer<typeof publicTrackValidator>;
export type AdminTrack = Infer<typeof adminTrackValidator>;

/** Types Chrome, Firefox, and Safari all play through a media element. */
export const AUDIO_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/vnd.wave",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
]);

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

export const MAX_PEAKS = 1024;

export function isStored(track: Track): track is StoredTrack {
  return "audio" in track;
}

/**
 * Why a file can't be track audio, or null. The server passes the blob's
 * `_storage` row; the dashboard passes `{ contentType: file.type, size:
 * file.size }` before it uploads, so both apply one rule.
 */
export function audioFileProblem(file: {
  contentType?: string;
  size: number;
}): string | null {
  const type = file.contentType?.split(";")[0].trim().toLowerCase();

  if (!type || !AUDIO_CONTENT_TYPES.has(type)) {
    return `Unsupported audio type ${file.contentType || "(none)"}`;
  }
  if (file.size <= 0) {
    return "Audio file is empty";
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return `Audio file is larger than ${MAX_AUDIO_BYTES / 1024 / 1024} MiB`;
  }

  return null;
}

/** Why a duration or peaks array can't describe a track, or null. */
export function trackAudioProblem(audio: {
  readonly duration: number;
  readonly peaks: readonly number[];
}): string | null {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    return "Audio duration must be a positive number of seconds";
  }
  if (audio.peaks.length === 0 || audio.peaks.length > MAX_PEAKS) {
    return `Audio peaks must have 1 to ${MAX_PEAKS} values`;
  }
  if (!audio.peaks.every((peak) => peak >= 0 && peak <= 1)) {
    return "Audio peaks must be between 0 and 1";
  }

  return null;
}

export type MetadataProblem = {
  readonly field: "title" | "artist";
  readonly message: string;
};

/**
 * Why these fields can't describe a track, one entry per field in field
 * order, or none. An absent field passes, so update's partial patch checks
 * only what it sends. Record may be empty.
 */
export function trackMetadataProblems(
  track: Partial<TrackMetadata>
): readonly MetadataProblem[] {
  return (["title", "artist"] as const).flatMap((field) =>
    track[field]?.trim() === ""
      ? [{ field, message: `track ${field} must not be empty` }]
      : []
  );
}

/**
 * db.patch removes a field set to undefined. `satisfies` fails the build
 * unless this names exactly the fields only a legacy track has.
 */
const DROP_LEGACY = {
  src: undefined,
  image: undefined,
  isLoop: undefined,
} as const satisfies {
  readonly [K in Exclude<keyof LegacyTrack, keyof StoredTrack>]: undefined;
};

type AttachPatch = typeof DROP_LEGACY & {
  readonly audio: TrackAudio;
  readonly updatedAt: number;
};

export type AttachPlan =
  | { kind: "unchanged" }
  | { kind: "patch"; patch: AttachPatch; deleteBlob: Id<"_storage"> | null };

/**
 * What attaching `audio` does to `track`. A blob's duration and peaks never
 * change, so the same blob again is a retry and changes nothing. Otherwise
 * it is a patch, so every field it doesn't name survives. A legacy track
 * drops `src`, `image`, and `isLoop` and becomes stored. A stored track takes
 * the new audio, and the old blob is deleted.
 */
export function planAttach(
  track: Track,
  audio: TrackAudio,
  now: number
): AttachPlan {
  const current = isStored(track) ? track.audio.storageId : null;

  if (current === audio.storageId) {
    return { kind: "unchanged" };
  }

  return {
    kind: "patch",
    patch: { ...DROP_LEGACY, audio, updatedAt: now },
    deleteBlob: current,
  };
}

export function toPublicTrack(track: StoredTrack, src: string): PublicTrack {
  return {
    id: String(track.publicId),
    title: track.title,
    src,
    artist: track.artist,
    record: track.record,
    duration: track.audio.duration,
    peaks: track.audio.peaks,
  };
}

/** The only path from a track to what the site plays. Null for a legacy track or a deleted blob. */
export async function resolvePublicTrack(
  ctx: Pick<QueryCtx, "storage">,
  track: Track
): Promise<PublicTrack | null> {
  if (!isStored(track)) {
    return null;
  }

  const src = await ctx.storage.getUrl(track.audio.storageId);

  return src === null ? null : toPublicTrack(track, src);
}

export async function toAdminTrack(
  ctx: Pick<QueryCtx, "storage">,
  track: Track
): Promise<AdminTrack> {
  return {
    id: track.publicId,
    title: track.title,
    artist: track.artist,
    record: track.record,
    audio: isStored(track)
      ? {
          kind: "stored",
          src: await ctx.storage.getUrl(track.audio.storageId),
          duration: track.audio.duration,
        }
      : { kind: "legacy", src: track.src },
  };
}

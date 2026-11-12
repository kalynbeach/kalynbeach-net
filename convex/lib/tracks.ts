import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  lookConfigValidator,
  type Look,
  type LookConfig,
  type LookId,
} from "./looks";

/**
 * Audio in Convex file storage. `duration` (seconds) and `peaks` (0 to 1)
 * describe this blob, so the WavePlayer never downloads a track to draw it.
 */
export const trackAudioValidator = v.object({
  storageId: v.id("_storage"),
  duration: v.number(),
  peaks: v.array(v.number()),
});

export const trackValidator = v.object({
  publicId: v.number(),
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  /**
   * The saved look the site draws for this track. Absent means none, so the
   * WavePlayer draws its own default, never the live look. Optional, so rows
   * from before looks still validate. looks.remove refuses a look any track
   * names.
   */
  look: v.optional(v.id("looks")),
  audio: trackAudioValidator,
});

export const trackMetadataValidator = v.object({
  title: v.string(),
  artist: v.string(),
  record: v.string(),
});

/** The WavePlayer block's track input plus its look. `id` is the publicId as a string. */
export const publicTrackValidator = v.object({
  id: v.string(),
  title: v.string(),
  src: v.string(),
  artist: v.string(),
  record: v.string(),
  duration: v.number(),
  peaks: v.array(v.number()),
  /**
   * The track's look as stored, or null for none, which draws the
   * WavePlayer's own default. Readers pass it through parseWaveformConfig.
   */
  look: v.union(lookConfigValidator, v.null()),
});

/** A dashboard row. `audio.src` is null when the track's blob is gone. */
export const adminTrackValidator = v.object({
  id: v.number(),
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  look: v.union(v.id("looks"), v.null()),
  audio: v.object({
    src: v.union(v.string(), v.null()),
    duration: v.number(),
  }),
});

export type TrackAudio = Infer<typeof trackAudioValidator>;
export type TrackMetadata = Infer<typeof trackMetadataValidator>;
export type Track = Infer<typeof trackValidator>;
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

export type ReplaceAudioPlan =
  | { kind: "unchanged" }
  | {
      kind: "patch";
      patch: { readonly audio: TrackAudio };
      deleteBlob: Id<"_storage">;
    };

/**
 * What replacing the audio of `track` with `audio` does. A blob's duration
 * and peaks never change, so the same blob again is a retry and changes
 * nothing.
 */
export function planReplaceAudio(
  track: Track,
  audio: TrackAudio
): ReplaceAudioPlan {
  const current = track.audio.storageId;

  if (current === audio.storageId) {
    return { kind: "unchanged" };
  }

  return {
    kind: "patch",
    patch: { audio },
    deleteBlob: current,
  };
}

/** The look setLook was asked for, as the handler read it. A `gone` id has no look row behind it. */
export type RequestedLook =
  | { readonly kind: "none" }
  | { readonly kind: "found"; readonly id: LookId }
  | { readonly kind: "gone"; readonly id: LookId };

export type SetLookPlan =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "patch";
      /** `look` is required even when undefined: db.patch removes a field only when its key is present. */
      readonly patch: { readonly look: LookId | undefined };
    }
  | { readonly kind: "refuse"; readonly message: string };

/**
 * What setLook does to `track`. A track that already holds the requested
 * look, or none when cleared, writes nothing before any check, so a retry of
 * a set that landed succeeds. A look that is gone is refused, so a track
 * never names a deleted look.
 */
export function planSetLook(
  track: Track,
  requested: RequestedLook
): SetLookPlan {
  const next = requested.kind === "none" ? null : requested.id;

  if (next === (track.look ?? null)) {
    return { kind: "unchanged" };
  }
  if (requested.kind === "gone") {
    return { kind: "refuse", message: "Look not found" };
  }

  return { kind: "patch", patch: { look: next ?? undefined } };
}

export function toPublicTrack(
  track: Track,
  src: string,
  look: LookConfig | null
): PublicTrack {
  return {
    id: String(track.publicId),
    title: track.title,
    src,
    artist: track.artist,
    record: track.record,
    duration: track.audio.duration,
    peaks: track.audio.peaks,
    look,
  };
}

/** The reads resolvePublicTracks makes: look rows and blob URLs. A QueryCtx is one. */
export type PublicTrackReader = {
  readonly db: {
    get(table: "looks", id: LookId): Promise<Pick<Look, "config"> | null>;
  };
  readonly storage: {
    getUrl(storageId: Id<"_storage">): Promise<string | null>;
  };
};

/**
 * The only path from tracks to what the site plays, in the order given.
 * Leaves out tracks whose blob is gone. Reads each look once, however many
 * tracks share it. A look row that is gone gives null, since a throw here
 * would reach every visitor. Never reads the site row.
 */
export async function resolvePublicTracks(
  ctx: PublicTrackReader,
  tracks: readonly Track[]
): Promise<PublicTrack[]> {
  const lookIds = new Set(
    tracks.flatMap((track) => (track.look ? [track.look] : []))
  );
  const [entries, srcs] = await Promise.all([
    Promise.all(
      [...lookIds].map(
        async (id) =>
          [id, (await ctx.db.get("looks", id))?.config ?? null] as const
      )
    ),
    Promise.all(
      tracks.map((track) => ctx.storage.getUrl(track.audio.storageId))
    ),
  ]);
  const looks = new Map(entries);

  return tracks.flatMap((track, index) => {
    const src = srcs[index];
    const look = track.look ? (looks.get(track.look) ?? null) : null;

    return src === null ? [] : [toPublicTrack(track, src, look)];
  });
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
    look: track.look ?? null,
    audio: {
      src: await ctx.storage.getUrl(track.audio.storageId),
      duration: track.audio.duration,
    },
  };
}

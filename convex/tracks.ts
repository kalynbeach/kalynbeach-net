import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { assertPositiveInteger } from "./lib/domain";
import {
  adminTrackValidator,
  audioFileProblem,
  isStored,
  planAttach,
  planSetLook,
  publicTrackValidator,
  resolvePublicTracks,
  toAdminTrack,
  trackAudioProblem,
  trackAudioValidator,
  trackMetadataProblems,
  trackMetadataValidator,
  type RequestedLook,
  type TrackAudio,
} from "./lib/tracks";

/*
 * A refusal an admin can cause throws ConvexError with its message as the
 * data, and the dashboard shows that message as written. Production Convex
 * replaces a plain Error's message with "Server Error", so only bug guards,
 * such as a non-integer id, stay plain Errors.
 */

/** Every track whose audio is in Convex storage, by publicId, with its look. */
export const list = query({
  args: {},
  returns: v.array(publicTrackValidator),
  handler: async (ctx) => {
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_public_id")
      .order("asc")
      .collect();

    return resolvePublicTracks(ctx, tracks);
  },
});

/** Every track in either shape, by publicId, for the dashboard. */
export const adminList = query({
  args: {},
  returns: v.array(adminTrackValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_public_id")
      .order("asc")
      .collect();

    return Promise.all(tracks.map((track) => toAdminTrack(ctx, track)));
  },
});

/**
 * Upload step 1. POST the file to the URL with its Content-Type, then pass
 * the returned storageId to create or attachAudio.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a track around an uploaded blob and returns its publicId, one no
 * track has had before. A retry finds the track that already holds the blob
 * and returns its publicId.
 */
export const create = mutation({
  args: { track: trackMetadataValidator, audio: trackAudioValidator },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [problem] = trackMetadataProblems(args.track);

    if (problem) {
      throw new ConvexError(problem.message);
    }

    const holder = await checkUpload(ctx, args.audio);

    if (holder) {
      return holder.publicId;
    }

    const [lastTrack, retired] = await Promise.all([
      ctx.db.query("tracks").withIndex("by_public_id").order("desc").first(),
      ctx.db.query("retiredTrackIds").unique(),
    ]);
    const publicId =
      Math.max(lastTrack?.publicId ?? 0, retired?.highest ?? 0) + 1;
    const now = Date.now();

    await ctx.db.insert("tracks", {
      publicId,
      ...args.track,
      audio: args.audio,
      createdAt: now,
      updatedAt: now,
    });

    return publicId;
  },
});

/**
 * Gives a track an uploaded blob. Converts a legacy track, or replaces a
 * stored track's audio and deletes the old blob. A retry changes nothing.
 */
export const attachAudio = mutation({
  args: { id: v.number(), audio: trackAudioValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "track id");

    const track = await findTrack(ctx, args.id);

    if (!track) {
      throw new ConvexError(`Track ${args.id} not found`);
    }

    const holder = await checkUpload(ctx, args.audio);

    if (holder && holder.publicId !== args.id) {
      throw new ConvexError(
        `Audio already belongs to track ${holder.publicId}`
      );
    }

    const plan = planAttach(track, args.audio, Date.now());

    if (plan.kind === "patch") {
      await ctx.db.patch("tracks", track._id, plan.patch);

      if (plan.deleteBlob) {
        await deleteBlob(ctx, plan.deleteBlob);
      }
    }

    return null;
  },
});

/** Edits metadata. Audio changes go through attachAudio. */
export const update = mutation({
  args: { id: v.number(), track: trackMetadataValidator.partial() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "track id");

    const [problem] = trackMetadataProblems(args.track);

    if (problem) {
      throw new ConvexError(problem.message);
    }

    const track = await findTrack(ctx, args.id);

    if (!track) {
      throw new ConvexError(`Track ${args.id} not found`);
    }

    await ctx.db.patch("tracks", track._id, {
      ...args.track,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Points a track at a saved look, or clears its look with null. A repeat
 * writes nothing. Refuses a look that no longer exists.
 */
export const setLook = mutation({
  args: { id: v.number(), look: v.union(v.id("looks"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "track id");

    const track = await findTrack(ctx, args.id);

    if (!track) {
      throw new ConvexError(`Track ${args.id} not found`);
    }

    const requested: RequestedLook =
      args.look === null
        ? { kind: "none" }
        : {
            kind: (await ctx.db.get("looks", args.look)) ? "found" : "gone",
            id: args.look,
          };
    const plan = planSetLook(track, requested, Date.now());

    switch (plan.kind) {
      case "unchanged":
        return null;
      case "refuse":
        throw new ConvexError(plan.message);
      case "patch":
        await ctx.db.patch("tracks", track._id, plan.patch);
        return null;
    }
  },
});

/**
 * Deletes a track and its blob. A track that is already gone is a no-op, and
 * a track whose blob is already gone is still deleted.
 */
export const remove = mutation({
  args: { id: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "track id");

    const track = await findTrack(ctx, args.id);

    if (!track) {
      return null;
    }

    const playlistTrack = await ctx.db
      .query("playlistTracks")
      .withIndex("by_track_id", (query) => query.eq("trackId", args.id))
      .first();

    if (playlistTrack) {
      throw new ConvexError(`Track ${args.id} is still used by a playlist`);
    }

    await ctx.db.delete("tracks", track._id);
    await retireTrackId(ctx, track.publicId);

    if (isStored(track)) {
      await deleteBlob(ctx, track.audio.storageId);
    }

    return null;
  },
});

/**
 * Deletes an uploaded blob that no track holds, for an upload the dashboard
 * gave up on after its save failed. A blob a track holds, such as one whose
 * save committed but whose reply was lost, stays. A missing blob is a no-op.
 */
export const discardUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (!(await findHolder(ctx, args.storageId))) {
      await deleteBlob(ctx, args.storageId);
    }

    return null;
  },
});

/** Records a removed track's publicId so create never issues it again. */
async function retireTrackId(
  ctx: MutationCtx,
  publicId: number
): Promise<void> {
  const retired = await ctx.db.query("retiredTrackIds").unique();

  if (!retired) {
    await ctx.db.insert("retiredTrackIds", { highest: publicId });
  } else if (publicId > retired.highest) {
    await ctx.db.patch("retiredTrackIds", retired._id, { highest: publicId });
  }
}

/**
 * Deletes a blob unless it is already gone, which a deletion in the Convex
 * dashboard can cause. storage.delete throws on a missing blob and would
 * roll back the write that dropped it.
 */
async function deleteBlob(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  if (await ctx.db.system.get("_storage", storageId)) {
    await ctx.storage.delete(storageId);
  }
}

function findTrack(
  ctx: MutationCtx,
  publicId: number
): Promise<Doc<"tracks"> | null> {
  return ctx.db
    .query("tracks")
    .withIndex("by_public_id", (query) => query.eq("publicId", publicId))
    .unique();
}

/**
 * Throws when the blob is missing or isn't usable audio, and returns the
 * track that already holds it, if any. A rejected blob stays unattached
 * until the dashboard discards it.
 */
async function checkUpload(
  ctx: MutationCtx,
  audio: TrackAudio
): Promise<Doc<"tracks"> | null> {
  const file = await ctx.db.system.get("_storage", audio.storageId);

  if (!file) {
    throw new ConvexError("Uploaded audio not found");
  }

  const problem = audioFileProblem(file) ?? trackAudioProblem(audio);

  if (problem) {
    throw new ConvexError(problem);
  }

  return findHolder(ctx, audio.storageId);
}

function findHolder(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<Doc<"tracks"> | null> {
  return ctx.db
    .query("tracks")
    .withIndex("by_audio_storage_id", (query) =>
      query.eq("audio.storageId", storageId)
    )
    .unique();
}

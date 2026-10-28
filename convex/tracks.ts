import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { assertNonEmpty, assertPositiveInteger } from "./lib/domain";
import {
  adminTrackValidator,
  audioFileProblem,
  isStored,
  planAttach,
  publicTrackValidator,
  resolvePublicTrack,
  toAdminTrack,
  trackAudioProblem,
  trackAudioValidator,
  trackMetadataValidator,
  type TrackAudio,
} from "./lib/tracks";

/** Every track whose audio is in Convex storage, by publicId. */
export const list = query({
  args: {},
  returns: v.array(publicTrackValidator),
  handler: async (ctx) => {
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_public_id")
      .order("asc")
      .collect();
    const publicTracks = await Promise.all(
      tracks.map((track) => resolvePublicTrack(ctx, track))
    );

    return publicTracks.filter((track) => track !== null);
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
 * Creates a track around an uploaded blob and returns its publicId. A retry
 * finds the track that already holds the blob and returns its publicId.
 */
export const create = mutation({
  args: { track: trackMetadataValidator, audio: trackAudioValidator },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNonEmpty(args.track.title, "track title");
    assertNonEmpty(args.track.artist, "track artist");

    const holder = await checkUpload(ctx, args.audio);

    if (holder) {
      return holder.publicId;
    }

    const lastTrack = await ctx.db
      .query("tracks")
      .withIndex("by_public_id")
      .order("desc")
      .first();
    const publicId = (lastTrack?.publicId ?? 0) + 1;
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
      throw new Error(`Track ${args.id} not found`);
    }

    const holder = await checkUpload(ctx, args.audio);

    if (holder && holder.publicId !== args.id) {
      throw new Error(`Audio already belongs to track ${holder.publicId}`);
    }

    const plan = planAttach(track, args.audio, Date.now());

    if (plan.kind === "replace") {
      await ctx.db.replace("tracks", track._id, plan.next);

      if (plan.deleteBlob) {
        await ctx.storage.delete(plan.deleteBlob);
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

    if (args.track.title !== undefined) {
      assertNonEmpty(args.track.title, "track title");
    }
    if (args.track.artist !== undefined) {
      assertNonEmpty(args.track.artist, "track artist");
    }

    const track = await findTrack(ctx, args.id);

    if (!track) {
      throw new Error(`Track ${args.id} not found`);
    }

    await ctx.db.patch("tracks", track._id, {
      ...args.track,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Deletes a track and its blob. A track that is already gone is a no-op. */
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
      throw new Error(`Track ${args.id} is still used by a playlist`);
    }

    await ctx.db.delete("tracks", track._id);

    if (isStored(track)) {
      await ctx.storage.delete(track.audio.storageId);
    }

    return null;
  },
});

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
 * track that already holds it, if any. A rejected blob stays unattached.
 */
async function checkUpload(
  ctx: MutationCtx,
  audio: TrackAudio
): Promise<Doc<"tracks"> | null> {
  const file = await ctx.db.system.get("_storage", audio.storageId);

  if (!file) {
    throw new Error("Uploaded audio not found");
  }

  const problem = audioFileProblem(file) ?? trackAudioProblem(audio);

  if (problem) {
    throw new Error(problem);
  }

  return ctx.db
    .query("tracks")
    .withIndex("by_audio_storage_id", (query) =>
      query.eq("audio.storageId", audio.storageId)
    )
    .unique();
}

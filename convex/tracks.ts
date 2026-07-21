import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import {
  assertHttpsUrl,
  assertLimit,
  assertNonEmpty,
  assertPositiveInteger,
  toTrackView,
} from "./lib/domain";
import { trackImageValidator, trackViewValidator } from "./validators";

const createTrackValidator = v.object({
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  src: v.string(),
  image: trackImageValidator,
  isLoop: v.boolean(),
});

const updateTrackValidator = v.object({
  title: v.optional(v.string()),
  artist: v.optional(v.string()),
  record: v.optional(v.string()),
  src: v.optional(v.string()),
  image: v.optional(trackImageValidator),
  isLoop: v.optional(v.boolean()),
});

export const list = query({
  args: { limit: v.number() },
  returns: v.array(trackViewValidator),
  handler: async (ctx, args) => {
    assertLimit(args.limit);
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_public_id")
      .order("asc")
      .take(args.limit);

    return tracks.map(toTrackView);
  },
});

export const getById = query({
  args: { id: v.number() },
  returns: v.union(trackViewValidator, v.null()),
  handler: async (ctx, args) => {
    assertPositiveInteger(args.id, "track id");
    const track = await ctx.db
      .query("tracks")
      .withIndex("by_public_id", (query) => query.eq("publicId", args.id))
      .unique();

    return track ? toTrackView(track) : null;
  },
});

export const create = mutation({
  args: { track: createTrackValidator },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNonEmpty(args.track.title, "track title");
    assertNonEmpty(args.track.artist, "track artist");
    assertHttpsUrl(args.track.src, "track src");

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
      createdAt: now,
      updatedAt: now,
    });

    return publicId;
  },
});

export const update = mutation({
  args: { id: v.number(), track: updateTrackValidator },
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
    if (args.track.src !== undefined) {
      assertHttpsUrl(args.track.src, "track src");
    }

    const track = await ctx.db
      .query("tracks")
      .withIndex("by_public_id", (query) => query.eq("publicId", args.id))
      .unique();

    if (!track) {
      throw new Error(`Track ${args.id} not found`);
    }

    await ctx.db.patch(track._id, { ...args.track, updatedAt: Date.now() });

    return null;
  },
});

export const remove = mutation({
  args: { id: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "track id");

    const track = await ctx.db
      .query("tracks")
      .withIndex("by_public_id", (query) => query.eq("publicId", args.id))
      .unique();

    if (!track) {
      throw new Error(`Track ${args.id} not found`);
    }

    const playlistTrack = await ctx.db
      .query("playlistTracks")
      .withIndex("by_track_id", (query) => query.eq("trackId", args.id))
      .first();

    if (playlistTrack) {
      throw new Error(`Track ${args.id} is still used by a playlist`);
    }

    await ctx.db.delete(track._id);

    return null;
  },
});

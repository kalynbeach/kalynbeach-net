import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import {
  assertLimit,
  assertNonEmpty,
  assertPositiveInteger,
  buildPlaylistPatch,
  toTrackView,
} from "./lib/domain";
import { playlistViewValidator } from "./validators";

async function getPlaylistView(ctx: QueryCtx, playlistId: number) {
  const playlist = await ctx.db
    .query("playlists")
    .withIndex("by_public_id", (query) => query.eq("publicId", playlistId))
    .unique();

  if (!playlist) {
    return null;
  }

  const playlistTracks = await ctx.db
    .query("playlistTracks")
    .withIndex("by_playlist_id_and_position", (query) =>
      query.eq("playlistId", playlistId)
    )
    .order("asc")
    .collect();
  const tracks = await Promise.all(
    playlistTracks.map(async (playlistTrack) => {
      const track = await ctx.db
        .query("tracks")
        .withIndex("by_public_id", (query) =>
          query.eq("publicId", playlistTrack.trackId)
        )
        .unique();

      if (!track) {
        throw new Error(`Track ${playlistTrack.trackId} not found`);
      }

      return toTrackView(track);
    })
  );

  return {
    id: playlist.publicId,
    title: playlist.title,
    tracks,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}

export const getById = query({
  args: { id: v.number() },
  returns: v.union(playlistViewValidator, v.null()),
  handler: async (ctx, args) => {
    assertPositiveInteger(args.id, "playlist id");

    return getPlaylistView(ctx, args.id);
  },
});

export const list = query({
  args: { limit: v.number() },
  returns: v.array(playlistViewValidator),
  handler: async (ctx, args) => {
    assertLimit(args.limit);
    const playlists = await ctx.db
      .query("playlists")
      .withIndex("by_public_id")
      .order("asc")
      .take(args.limit);
    const playlistViews = await Promise.all(
      playlists.map((playlist) => getPlaylistView(ctx, playlist.publicId))
    );

    return playlistViews.filter((playlist) => playlist !== null);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertNonEmpty(args.title, "playlist title");

    const lastPlaylist = await ctx.db
      .query("playlists")
      .withIndex("by_public_id")
      .order("desc")
      .first();
    const publicId = (lastPlaylist?.publicId ?? 0) + 1;
    const now = Date.now();

    await ctx.db.insert("playlists", {
      publicId,
      title: args.title,
      ...(args.description === undefined
        ? {}
        : { description: args.description }),
      createdAt: now,
      updatedAt: now,
    });

    return publicId;
  },
});

export const update = mutation({
  args: {
    id: v.number(),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "playlist id");

    if (args.title !== undefined) {
      assertNonEmpty(args.title, "playlist title");
    }

    const playlist = await ctx.db
      .query("playlists")
      .withIndex("by_public_id", (query) => query.eq("publicId", args.id))
      .unique();

    if (!playlist) {
      throw new Error(`Playlist ${args.id} not found`);
    }

    await ctx.db.patch(playlist._id, buildPlaylistPatch(args, Date.now()));

    return null;
  },
});

export const remove = mutation({
  args: { id: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.id, "playlist id");

    const playlist = await ctx.db
      .query("playlists")
      .withIndex("by_public_id", (query) => query.eq("publicId", args.id))
      .unique();

    if (!playlist) {
      throw new Error(`Playlist ${args.id} not found`);
    }

    const playlistTracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_id_and_position", (query) =>
        query.eq("playlistId", args.id)
      )
      .collect();

    for (const playlistTrack of playlistTracks) {
      await ctx.db.delete(playlistTrack._id);
    }
    await ctx.db.delete(playlist._id);

    return null;
  },
});

export const addTrack = mutation({
  args: {
    playlistId: v.number(),
    trackId: v.number(),
    position: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.playlistId, "playlist id");
    assertPositiveInteger(args.trackId, "track id");

    const [playlist, track, existingPlaylistTrack, playlistTracks] =
      await Promise.all([
        ctx.db
          .query("playlists")
          .withIndex("by_public_id", (query) =>
            query.eq("publicId", args.playlistId)
          )
          .unique(),
        ctx.db
          .query("tracks")
          .withIndex("by_public_id", (query) =>
            query.eq("publicId", args.trackId)
          )
          .unique(),
        ctx.db
          .query("playlistTracks")
          .withIndex("by_playlist_id_and_track_id", (query) =>
            query.eq("playlistId", args.playlistId).eq("trackId", args.trackId)
          )
          .unique(),
        ctx.db
          .query("playlistTracks")
          .withIndex("by_playlist_id_and_position", (query) =>
            query.eq("playlistId", args.playlistId)
          )
          .order("asc")
          .collect(),
      ]);

    if (!playlist) {
      throw new Error(`Playlist ${args.playlistId} not found`);
    }
    if (!track) {
      throw new Error(`Track ${args.trackId} not found`);
    }
    if (existingPlaylistTrack) {
      throw new Error(
        `Track ${args.trackId} is already in playlist ${args.playlistId}`
      );
    }

    const position = args.position ?? playlistTracks.length + 1;
    assertPositiveInteger(position, "playlist track position");
    if (position > playlistTracks.length + 1) {
      throw new Error("playlist track position is outside the playlist");
    }

    for (const playlistTrack of playlistTracks) {
      if (playlistTrack.position >= position) {
        await ctx.db.patch(playlistTrack._id, {
          position: playlistTrack.position + 1,
        });
      }
    }
    await ctx.db.insert("playlistTracks", {
      playlistId: args.playlistId,
      trackId: args.trackId,
      position,
      createdAt: Date.now(),
    });

    return null;
  },
});

export const removeTrack = mutation({
  args: { playlistId: v.number(), trackId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.playlistId, "playlist id");
    assertPositiveInteger(args.trackId, "track id");

    const playlistTrack = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_id_and_track_id", (query) =>
        query.eq("playlistId", args.playlistId).eq("trackId", args.trackId)
      )
      .unique();

    if (!playlistTrack) {
      throw new Error(
        `Track ${args.trackId} is not in playlist ${args.playlistId}`
      );
    }

    await ctx.db.delete(playlistTrack._id);
    const remainingTracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_id_and_position", (query) =>
        query.eq("playlistId", args.playlistId)
      )
      .order("asc")
      .collect();

    for (const [index, remainingTrack] of remainingTracks.entries()) {
      const position = index + 1;
      if (remainingTrack.position !== position) {
        await ctx.db.patch(remainingTrack._id, { position });
      }
    }

    return null;
  },
});

export const reorderTrack = mutation({
  args: { playlistId: v.number(), trackId: v.number(), position: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.playlistId, "playlist id");
    assertPositiveInteger(args.trackId, "track id");
    assertPositiveInteger(args.position, "playlist track position");

    const playlistTracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_id_and_position", (query) =>
        query.eq("playlistId", args.playlistId)
      )
      .order("asc")
      .collect();
    const playlistTrack = playlistTracks.find(
      (candidate) => candidate.trackId === args.trackId
    );

    if (!playlistTrack) {
      throw new Error(
        `Track ${args.trackId} is not in playlist ${args.playlistId}`
      );
    }
    if (args.position > playlistTracks.length) {
      throw new Error("playlist track position is outside the playlist");
    }

    const reorderedTracks = playlistTracks.filter(
      (candidate) => candidate._id !== playlistTrack._id
    );
    reorderedTracks.splice(args.position - 1, 0, playlistTrack);

    for (const [index, reorderedTrack] of reorderedTracks.entries()) {
      const position = index + 1;
      if (reorderedTrack.position !== position) {
        await ctx.db.patch(reorderedTrack._id, { position });
      }
    }

    return null;
  },
});

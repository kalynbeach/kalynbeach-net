import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { repositorySeedData, validateMigrationData } from "./lib/migration";

const migrationResultValidator = v.object({
  tracks: v.number(),
  playlists: v.number(),
  playlistTracks: v.number(),
});

async function assertNoPositionConflicts(ctx: MutationCtx): Promise<void> {
  for (const relation of repositorySeedData.playlistTracks) {
    const existingRelations = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist_id_and_position", (query) =>
        query.eq("playlistId", relation.playlistId)
      )
      .collect();
    const conflict = existingRelations.find(
      (candidate) =>
        candidate.position === relation.position &&
        candidate.trackId !== relation.trackId
    );

    if (conflict) {
      throw new Error(
        `playlist ${relation.playlistId} position ${relation.position} is already occupied`
      );
    }
  }
}

export const seedPreview = internalMutation({
  args: {},
  returns: migrationResultValidator,
  handler: async (ctx) => {
    validateMigrationData(repositorySeedData);
    await assertNoPositionConflicts(ctx);

    for (const track of repositorySeedData.tracks) {
      const existing = await ctx.db
        .query("tracks")
        .withIndex("by_public_id", (query) =>
          query.eq("publicId", track.publicId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, track);
      } else {
        await ctx.db.insert("tracks", track);
      }
    }

    for (const playlist of repositorySeedData.playlists) {
      const existing = await ctx.db
        .query("playlists")
        .withIndex("by_public_id", (query) =>
          query.eq("publicId", playlist.publicId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, playlist);
      } else {
        await ctx.db.insert("playlists", playlist);
      }
    }

    for (const playlistTrack of repositorySeedData.playlistTracks) {
      const existing = await ctx.db
        .query("playlistTracks")
        .withIndex("by_playlist_id_and_track_id", (query) =>
          query
            .eq("playlistId", playlistTrack.playlistId)
            .eq("trackId", playlistTrack.trackId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, playlistTrack);
      } else {
        await ctx.db.insert("playlistTracks", playlistTrack);
      }
    }

    return {
      tracks: repositorySeedData.tracks.length,
      playlists: repositorySeedData.playlists.length,
      playlistTracks: repositorySeedData.playlistTracks.length,
    };
  },
});

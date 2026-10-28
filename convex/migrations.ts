import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  previewSamples,
  renderSampleWav,
  repositorySeedData,
  validateMigrationData,
} from "./lib/migration";

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

async function hasTrack(ctx: MutationCtx, publicId: number): Promise<boolean> {
  const track = await ctx.db
    .query("tracks")
    .withIndex("by_public_id", (query) => query.eq("publicId", publicId))
    .unique();

  return track !== null;
}

/**
 * Gives a preview the production catalog (legacy S3 tracks, a playlist) and
 * stored sample tracks it can play. Inserts only the rows that are missing,
 * so a rerun converges any preview, and one transaction, so a failure stores
 * nothing. Returns the rows it inserted.
 */
export const seedPreview = internalMutation({
  args: {},
  returns: migrationResultValidator,
  handler: async (ctx) => {
    validateMigrationData(repositorySeedData);
    await assertNoPositionConflicts(ctx);

    const inserted = { tracks: 0, playlists: 0, playlistTracks: 0 };

    for (const track of repositorySeedData.tracks) {
      if (!(await hasTrack(ctx, track.publicId))) {
        await ctx.db.insert("tracks", track);
        inserted.tracks += 1;
      }
    }

    for (const sample of previewSamples) {
      if (await hasTrack(ctx, sample.publicId)) {
        continue;
      }

      const { wav, duration, peaks } = renderSampleWav(sample);
      const storageId = await ctx.storage.store(
        new Blob([wav], { type: "audio/wav" })
      );
      const now = Date.now();

      await ctx.db.insert("tracks", {
        publicId: sample.publicId,
        title: sample.title,
        artist: sample.artist,
        record: sample.record,
        audio: { storageId, duration, peaks },
        createdAt: now,
        updatedAt: now,
      });
      inserted.tracks += 1;
    }

    for (const playlist of repositorySeedData.playlists) {
      const existing = await ctx.db
        .query("playlists")
        .withIndex("by_public_id", (query) =>
          query.eq("publicId", playlist.publicId)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("playlists", playlist);
        inserted.playlists += 1;
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

      if (!existing) {
        await ctx.db.insert("playlistTracks", playlistTrack);
        inserted.playlistTracks += 1;
      }
    }

    return inserted;
  },
});

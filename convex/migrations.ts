import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  previewSamples,
  renderSampleWav,
  repositorySeedData,
  seedsSampleLook,
  validateMigrationData,
  type PreviewSample,
} from "./lib/migration";
import { planCreate } from "./lib/looks";

const migrationResultValidator = v.object({
  tracks: v.number(),
  playlists: v.number(),
  playlistTracks: v.number(),
  looks: v.number(),
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

async function trackByPublicId(ctx: MutationCtx, publicId: number) {
  return ctx.db
    .query("tracks")
    .withIndex("by_public_id", (query) => query.eq("publicId", publicId))
    .unique();
}

async function hasTrack(ctx: MutationCtx, publicId: number): Promise<boolean> {
  return (await trackByPublicId(ctx, publicId)) !== null;
}

/** The sample's saved look, inserted on the first run and found by its createKey after. */
async function previewLook(
  ctx: MutationCtx,
  sample: PreviewSample
): Promise<{ id: Id<"looks">; inserted: boolean }> {
  const existing = await ctx.db
    .query("looks")
    .withIndex("by_create_key", (query) =>
      query.eq("createKey", sample.look.createKey)
    )
    .unique();
  const plan = planCreate(existing, sample.look, Date.now());

  switch (plan.kind) {
    case "existing":
      return { id: plan.id, inserted: false };
    case "insert":
      return { id: await ctx.db.insert("looks", plan.look), inserted: true };
    case "refuse":
      throw new Error(`preview look ${sample.look.name}: bad ${plan.code}`);
  }
}

/**
 * Gives a preview the production catalog (legacy S3 tracks, a playlist) and
 * stored sample tracks it can play, each with a saved look of its own.
 * Inserts only the rows that are missing, and gives a sample track its look
 * only in the run that creates that look, so a rerun converges any preview
 * without undoing a look chosen on the dashboard, the player's default
 * included. One transaction, so a failure stores nothing.
 * Returns the rows it inserted. Run it on preview and local deployments
 * only.
 */
export const seedPreview = internalMutation({
  args: {},
  returns: migrationResultValidator,
  handler: async (ctx) => {
    validateMigrationData(repositorySeedData);
    await assertNoPositionConflicts(ctx);

    const inserted = { tracks: 0, playlists: 0, playlistTracks: 0, looks: 0 };

    for (const track of repositorySeedData.tracks) {
      if (!(await hasTrack(ctx, track.publicId))) {
        await ctx.db.insert("tracks", track);
        inserted.tracks += 1;
      }
    }

    for (const sample of previewSamples) {
      const look = await previewLook(ctx, sample);
      inserted.looks += Number(look.inserted);
      const track = await trackByPublicId(ctx, sample.publicId);

      if (track) {
        if (seedsSampleLook(track, look.inserted)) {
          await ctx.db.patch("tracks", track._id, { look: look.id });
        }
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
        look: look.id,
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

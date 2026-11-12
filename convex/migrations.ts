import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  previewSamples,
  renderSampleWav,
  seedsSampleLook,
  seedsSampleTrack,
  type PreviewSample,
} from "./lib/migration";
import { planCreate } from "./lib/looks";

const migrationResultValidator = v.object({
  tracks: v.number(),
  looks: v.number(),
});

async function trackByPublicId(ctx: MutationCtx, publicId: number) {
  return ctx.db
    .query("tracks")
    .withIndex("by_public_id", (query) => query.eq("publicId", publicId))
    .unique();
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
  const plan = planCreate(existing, sample.look);

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
 * Gives a preview sample tracks it can play, each with a saved look of its
 * own. Inserts only the rows that are missing, and gives a sample track its
 * look only in the run that creates that look, so a rerun converges any
 * preview without undoing a look chosen on the dashboard, the player's
 * default included. A sample track removed on the dashboard stays removed.
 * One transaction, so a failure stores nothing. Returns the rows it
 * inserted. Run it on preview and local deployments only.
 */
export const seedPreview = internalMutation({
  args: {},
  returns: migrationResultValidator,
  handler: async (ctx) => {
    const inserted = { tracks: 0, looks: 0 };
    const retired = await ctx.db.query("retiredTrackIds").unique();

    for (const sample of previewSamples) {
      const track = await trackByPublicId(ctx, sample.publicId);

      if (!track && !seedsSampleTrack(sample.publicId, retired)) {
        continue;
      }

      const look = await previewLook(ctx, sample);
      inserted.looks += Number(look.inserted);

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

      await ctx.db.insert("tracks", {
        publicId: sample.publicId,
        title: sample.title,
        artist: sample.artist,
        record: sample.record,
        audio: { storageId, duration, peaks },
        look: look.id,
      });
      inserted.tracks += 1;
    }

    return inserted;
  },
});

const droppedTimestampsValidator = v.object({
  users: v.number(),
  tracks: v.number(),
  looks: v.number(),
});

function stamped(row: { createdAt?: number; updatedAt?: number }): boolean {
  return row.createdAt !== undefined || row.updatedAt !== undefined;
}

/** A patch that removes both fields: db.patch drops a key whose value is undefined. */
const unstamped = { createdAt: undefined, updatedAt: undefined };

/**
 * Removes the unread createdAt and updatedAt fields from every users, tracks,
 * and looks row, so a later schema can drop them. Patches only rows that
 * hold either field, so a rerun changes nothing. Returns the rows it changed
 * per table.
 */
export const dropTimestamps = internalMutation({
  args: {},
  returns: droppedTimestampsValidator,
  handler: async (ctx) => {
    const [users, tracks, looks] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("tracks").collect(),
      ctx.db.query("looks").collect(),
    ]);
    const changed = {
      users: users.filter(stamped),
      tracks: tracks.filter(stamped),
      looks: looks.filter(stamped),
    };

    await Promise.all([
      ...changed.users.map((row) => ctx.db.patch("users", row._id, unstamped)),
      ...changed.tracks.map((row) =>
        ctx.db.patch("tracks", row._id, unstamped)
      ),
      ...changed.looks.map((row) => ctx.db.patch("looks", row._id, unstamped)),
    ]);

    return {
      users: changed.users.length,
      tracks: changed.tracks.length,
      looks: changed.looks.length,
    };
  },
});

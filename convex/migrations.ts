import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  previewSamples,
  renderSampleWav,
  seedsSampleLook,
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
 * Gives a preview sample tracks it can play, each with a saved look of its
 * own. Inserts only the rows that are missing, and gives a sample track its
 * look only in the run that creates that look, so a rerun converges any
 * preview without undoing a look chosen on the dashboard, the player's
 * default included. One transaction, so a failure stores nothing.
 * Returns the rows it inserted. Run it on preview and local deployments
 * only.
 */
export const seedPreview = internalMutation({
  args: {},
  returns: migrationResultValidator,
  handler: async (ctx) => {
    const inserted = { tracks: 0, looks: 0 };

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

    return inserted;
  },
});

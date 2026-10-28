import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import {
  adminLookValidator,
  liveLookValidator,
  lookConfigValidator,
  planCreate,
  planRemove,
  planRename,
  planSave,
  planSetLive,
  refuse,
  toAdminLook,
  type Site,
} from "./lib/looks";

/**
 * The live look's stored config, or null. Public: the root layout reads it
 * for first paint and every open page subscribes to it. Missing data
 * returns null, since a throw here would reach every visitor.
 */
export const live = query({
  args: {},
  returns: liveLookValidator,
  handler: async (ctx) => {
    const site = await findSite(ctx);

    if (!site) {
      return null;
    }

    const look = await ctx.db.get("looks", site.liveLook);

    return look?.config ?? null;
  },
});

/** Every look, oldest first, with the live one marked. */
export const list = query({
  args: {},
  returns: v.array(adminLookValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const looks = await ctx.db.query("looks").order("asc").collect();
    const site = await findSite(ctx);

    return looks.map((look) => toAdminLook(look, site));
  },
});

/**
 * Stores a new look and returns its id. A repeat with the same createKey
 * returns the first look's id and writes nothing.
 */
export const create = mutation({
  args: {
    createKey: v.string(),
    name: v.string(),
    config: lookConfigValidator,
  },
  returns: v.id("looks"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("looks")
      .withIndex("by_create_key", (query) =>
        query.eq("createKey", args.createKey)
      )
      .unique();
    const plan = planCreate(existing, args, Date.now());

    switch (plan.kind) {
      case "existing":
        return plan.id;
      case "insert":
        return ctx.db.insert("looks", plan.look);
      case "refuse":
        return refuse(plan.code);
    }
  },
});

/** Replaces a look's config. The name changes through rename. */
export const save = mutation({
  args: { id: v.id("looks"), config: lookConfigValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = planSave(
      await ctx.db.get("looks", args.id),
      args.config,
      Date.now()
    );

    if (plan.kind === "refuse") {
      refuse(plan.code);
    }

    await ctx.db.patch("looks", args.id, plan.patch);

    return null;
  },
});

/** Renames a look. The config changes through save. */
export const rename = mutation({
  args: { id: v.id("looks"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = planRename(
      await ctx.db.get("looks", args.id),
      args.name,
      Date.now()
    );

    if (plan.kind === "refuse") {
      refuse(plan.code);
    }

    await ctx.db.patch("looks", args.id, plan.patch);

    return null;
  },
});

/** Deletes a look. Refuses the live look. A look that is already gone is a no-op. */
export const remove = mutation({
  args: { id: v.id("looks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = planRemove(
      await ctx.db.get("looks", args.id),
      await findSite(ctx)
    );

    switch (plan.kind) {
      case "refuse":
        return refuse(plan.code);
      case "delete":
        await ctx.db.delete("looks", plan.id);
        return null;
      case "gone":
        return null;
    }
  },
});

/**
 * Puts a look on the site. Every open page follows within one subscription
 * update. Setting the live look again writes nothing.
 */
export const setLive = mutation({
  args: { id: v.id("looks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = planSetLive(
      await ctx.db.get("looks", args.id),
      await findSite(ctx)
    );

    switch (plan.kind) {
      case "refuse":
        return refuse(plan.code);
      case "insert":
        await ctx.db.insert("site", plan.site);
        return null;
      case "patch":
        await ctx.db.patch("site", plan.id, plan.site);
        return null;
      case "unchanged":
        return null;
    }
  },
});

/**
 * The one site row, or null before the first setLive. unique() throws on a
 * second row, which can't appear: only setLive inserts, after reading this,
 * and Convex serializes mutations.
 */
function findSite(ctx: QueryCtx | MutationCtx): Promise<Site | null> {
  return ctx.db.query("site").unique();
}

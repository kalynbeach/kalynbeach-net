import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, requireAdmin, requireIdentity } from "./lib/auth";
import { userAccessValidator } from "./validators";

export const current = query({
  args: {},
  returns: v.union(userAccessValidator, v.null()),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);

    return user ? { role: user.role } : null;
  },
});

export const ensureCurrent = mutation({
  args: {},
  returns: userAccessValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (query) =>
        query.eq("clerkUserId", identity.subject)
      )
      .unique();

    if (existingUser) {
      return { role: existingUser.role };
    }

    const now = Date.now();
    await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      role: "guest",
      createdAt: now,
      updatedAt: now,
    });

    return { role: "guest" as const };
  },
});

export const claimConfiguredAdmin = mutation({
  args: {},
  returns: userAccessValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const configuredAdminId = process.env.INITIAL_ADMIN_CLERK_USER_ID;

    if (!configuredAdminId) {
      throw new Error("INITIAL_ADMIN_CLERK_USER_ID is not configured");
    }

    if (identity.subject !== configuredAdminId) {
      throw new Error("Current Clerk user is not the configured initial admin");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (query) =>
        query.eq("clerkUserId", identity.subject)
      )
      .unique();
    const now = Date.now();

    if (!existingUser) {
      const userId = await ctx.db.insert("users", {
        clerkUserId: identity.subject,
        role: "guest",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(userId, { role: "admin", updatedAt: now });
    } else if (existingUser.role !== "admin") {
      await ctx.db.patch(existingUser._id, { role: "admin", updatedAt: now });
    }

    return { role: "admin" as const };
  },
});

export const adminAuthorization = query({
  args: {},
  returns: v.object({ role: v.literal("admin") }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return { role: "admin" as const };
  },
});

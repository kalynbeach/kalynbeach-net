import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx | MutationCtx, "auth">;
type UserContext = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireIdentity(ctx: AuthContext): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Authentication required");
  }

  return identity;
}

export async function findCurrentUser(
  ctx: UserContext
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (query) =>
      query.eq("clerkUserId", identity.subject)
    )
    .unique();
}

export async function requireCurrentUser(
  ctx: UserContext
): Promise<Doc<"users">> {
  await requireIdentity(ctx);
  const user = await findCurrentUser(ctx);

  if (!user) {
    throw new Error("Convex user has not been provisioned");
  }

  return user;
}

export async function requireAdmin(ctx: UserContext): Promise<Doc<"users">> {
  const user = await requireCurrentUser(ctx);

  if (user.role !== "admin") {
    throw new Error("Admin role required");
  }

  return user;
}

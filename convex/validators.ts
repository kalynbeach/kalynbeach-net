import { v } from "convex/values";

export const userRoleValidator = v.union(
  v.literal("guest"),
  v.literal("vip"),
  v.literal("admin")
);

export const userAccessValidator = v.object({
  role: userRoleValidator,
});

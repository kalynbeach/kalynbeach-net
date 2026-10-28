import { v } from "convex/values";
import { publicTrackValidator } from "./lib/tracks";

export const userRoleValidator = v.union(
  v.literal("guest"),
  v.literal("vip"),
  v.literal("admin")
);

export const userAccessValidator = v.object({
  role: userRoleValidator,
});

export const playlistViewValidator = v.object({
  id: v.number(),
  title: v.string(),
  tracks: v.array(publicTrackValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

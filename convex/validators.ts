import { v } from "convex/values";

export const userRoleValidator = v.union(
  v.literal("guest"),
  v.literal("vip"),
  v.literal("admin")
);

export const userAccessValidator = v.object({
  role: userRoleValidator,
});

export const trackImageValidator = v.object({
  src: v.string(),
  alt: v.string(),
});

export const trackViewValidator = v.object({
  id: v.number(),
  title: v.string(),
  artist: v.string(),
  record: v.string(),
  src: v.string(),
  image: trackImageValidator,
  isLoop: v.boolean(),
});

export const playlistViewValidator = v.object({
  id: v.number(),
  title: v.string(),
  tracks: v.array(trackViewValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

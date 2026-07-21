import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { trackImageValidator, userRoleValidator } from "./validators";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    role: userRoleValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_user_id", ["clerkUserId"]),

  tracks: defineTable({
    publicId: v.number(),
    title: v.string(),
    artist: v.string(),
    record: v.string(),
    src: v.string(),
    image: trackImageValidator,
    isLoop: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_public_id", ["publicId"]),

  playlists: defineTable({
    publicId: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_public_id", ["publicId"]),

  playlistTracks: defineTable({
    playlistId: v.number(),
    trackId: v.number(),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_playlist_id_and_position", ["playlistId", "position"])
    .index("by_playlist_id_and_track_id", ["playlistId", "trackId"])
    .index("by_track_id", ["trackId"]),
});

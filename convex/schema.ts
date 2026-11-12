import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { lookValidator, siteValidator } from "./lib/looks";
import { trackValidator } from "./lib/tracks";
import { userRoleValidator } from "./validators";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    role: userRoleValidator,
    /**
     * Unread. Optional only so rows written before migrations:dropTimestamps
     * validate. Remove them once it has run.
     */
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_clerk_user_id", ["clerkUserId"]),

  tracks: defineTable(trackValidator)
    .index("by_public_id", ["publicId"])
    .index("by_audio_storage_id", ["audio.storageId"])
    .index("by_look", ["look", "publicId"]),

  /**
   * At most one row: the highest publicId a removed track had. tracks.create
   * issues ids above it, so a removed track's id never names another track.
   */
  retiredTrackIds: defineTable({ highest: v.number() }),

  looks: defineTable(lookValidator).index("by_create_key", ["createKey"]),

  site: defineTable(siteValidator),
});

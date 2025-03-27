import { z } from "zod";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";
import type { WavePlayerTrack } from "@/lib/types/wave-player";

/**
 * Schema for the image object in WavePlayerTrack
 */
export const trackImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
});

/**
 * Schema for database track data (as it exists in the database)
 */
export const dbTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string(),
  record: z.string().nullable(),
  src: z.string(),
  image: z.unknown().nullable(), // Json type from DB
  isLoop: z.boolean(),
  created_at: z.string(),
});

/**
 * Schema for application track data (WavePlayerTrack)
 */
export const wavePlayerTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string(),
  record: z.string(),
  src: z.string(),
  image: trackImageSchema,
  isLoop: z.boolean(),
});

/**
 * Schema for track data when creating a new track
 */
export const trackInsertSchema = z.object({
  title: z.string(),
  artist: z.string(),
  record: z.string().nullable().optional(),
  src: z.string(),
  image: trackImageSchema.nullable().optional(),
  isLoop: z.boolean().optional(),
});

/**
 * Schema for track data when updating an existing track
 */
export const trackUpdateSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  record: z.string().nullable().optional(),
  src: z.string().optional(),
  image: trackImageSchema.nullable().optional(),
  isLoop: z.boolean().optional(),
});

/**
 * Transform a database track to a WavePlayerTrack
 */
export function dbTrackToWavePlayerTrack(dbTrack: Tables<"tracks">): WavePlayerTrack {
  return wavePlayerTrackSchema.parse({
    id: dbTrack.id,
    title: dbTrack.title,
    artist: dbTrack.artist,
    record: dbTrack.record || "",
    src: dbTrack.src,
    image: dbTrack.image || { src: "", alt: "" },
    isLoop: dbTrack.isLoop,
  });
}

/**
 * Transform a WavePlayerTrack to a database track (for insert)
 */
export function wavePlayerTrackToDbTrack(track: Omit<WavePlayerTrack, "id">): TablesInsert<"tracks"> {
  return {
    title: track.title,
    artist: track.artist,
    record: track.record || null,
    src: track.src,
    image: track.image,
    isLoop: track.isLoop,
  };
}

/**
 * Transform a partial WavePlayerTrack to a database track update
 */
export function wavePlayerTrackUpdateToDbTrackUpdate(
  trackUpdate: Partial<Omit<WavePlayerTrack, "id">>
): TablesUpdate<"tracks"> {
  const dbUpdate: TablesUpdate<"tracks"> = {};

  if (trackUpdate.title !== undefined) dbUpdate.title = trackUpdate.title;
  if (trackUpdate.artist !== undefined) dbUpdate.artist = trackUpdate.artist;
  if (trackUpdate.record !== undefined) dbUpdate.record = trackUpdate.record || null;
  if (trackUpdate.src !== undefined) dbUpdate.src = trackUpdate.src;
  if (trackUpdate.image !== undefined) dbUpdate.image = trackUpdate.image;
  if (trackUpdate.isLoop !== undefined) dbUpdate.isLoop = trackUpdate.isLoop;

  return dbUpdate;
}

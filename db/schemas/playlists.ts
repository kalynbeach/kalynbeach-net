import { z } from "zod";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import { wavePlayerTrackSchema } from "./tracks";

/**
 * Schema for database playlist data (as it exists in the database)
 */
export const dbPlaylistSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Schema for playlist data when creating a new playlist
 */
export const playlistInsertSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
});

/**
 * Schema for playlist data when updating an existing playlist
 */
export const playlistUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
});

/**
 * Schema for application playlist data (WavePlayerPlaylist)
 */
export const wavePlayerPlaylistSchema = z.object({
  id: z.number(),
  title: z.string(),
  tracks: z.array(wavePlayerTrackSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Transform a database playlist to a WavePlayerPlaylist
 */
export function dbPlaylistToWavePlayerPlaylist(
  dbPlaylist: Tables<"playlists">, 
  tracks: z.infer<typeof wavePlayerTrackSchema>[]
): WavePlayerPlaylist {
  return wavePlayerPlaylistSchema.parse({
    id: dbPlaylist.id,
    title: dbPlaylist.title,
    tracks: tracks,
    createdAt: new Date(dbPlaylist.created_at),
    updatedAt: new Date(dbPlaylist.created_at), // Using created_at as there's no updated_at field
  });
}

/**
 * Transform a WavePlayerPlaylist to a database playlist (for insert)
 */
export function wavePlayerPlaylistToDbPlaylist(
  playlist: Omit<WavePlayerPlaylist, "id" | "tracks" | "createdAt" | "updatedAt">
): TablesInsert<"playlists"> {
  return {
    title: playlist.title,
    description: null, // Assuming description is not part of WavePlayerPlaylist
  };
}

/**
 * Transform a partial WavePlayerPlaylist to a database playlist update
 */
export function wavePlayerPlaylistUpdateToDbPlaylistUpdate(
  playlistUpdate: Partial<Omit<WavePlayerPlaylist, "id" | "tracks" | "createdAt" | "updatedAt">>
): TablesUpdate<"playlists"> {
  const dbUpdate: TablesUpdate<"playlists"> = {};

  if (playlistUpdate.title !== undefined) dbUpdate.title = playlistUpdate.title;

  return dbUpdate;
}

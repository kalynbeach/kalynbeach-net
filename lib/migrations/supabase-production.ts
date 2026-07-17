import { z } from "zod";
import type { MigrationData } from "@/convex/lib/migration";
import { validateMigrationData } from "@/convex/lib/migration";

const positiveInteger = z.number().int().positive();
const timestamp = z.string().transform((value, context) => {
  const parsed = Date.parse(value);

  if (!Number.isSafeInteger(parsed)) {
    context.addIssue({ code: "custom", message: "invalid timestamp" });
    return z.NEVER;
  }

  return parsed;
});

const imageSchema = z
  .object({ src: z.string().min(1), alt: z.string().min(1) })
  .passthrough();

export const migrationTrackSchema = z.object({
  publicId: positiveInteger,
  title: z.string().min(1),
  artist: z.string().min(1),
  record: z.string(),
  src: z.url().refine((value) => value.startsWith("https://"), {
    message: "track source must use HTTPS",
  }),
  image: z.object({ src: z.string().min(1), alt: z.string().min(1) }),
  isLoop: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const migrationPlaylistSchema = z.object({
  publicId: positiveInteger,
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const migrationPlaylistTrackSchema = z.object({
  playlistId: positiveInteger,
  trackId: positiveInteger,
  position: positiveInteger,
  createdAt: z.number().int().nonnegative(),
});

export const supabaseTrackSchema = z.object({
  id: positiveInteger,
  title: z.string().min(1),
  artist: z.string().min(1),
  record: z.string().nullable(),
  src: z.url().refine((value) => value.startsWith("https://"), {
    message: "track source must use HTTPS",
  }),
  image: z.unknown().nullable(),
  isLoop: z.boolean(),
  created_at: timestamp,
});

export const supabasePlaylistSchema = z.object({
  id: positiveInteger,
  title: z.string().min(1),
  description: z.string().nullable(),
  created_at: timestamp,
});

export const supabasePlaylistTrackSchema = z.object({
  id: positiveInteger,
  playlist_id: positiveInteger,
  track_id: positiveInteger,
  position: positiveInteger,
  created_at: timestamp,
});

export type SupabaseTrack = z.infer<typeof supabaseTrackSchema>;
export type SupabasePlaylist = z.infer<typeof supabasePlaylistSchema>;
export type SupabasePlaylistTrack = z.infer<typeof supabasePlaylistTrackSchema>;

type SupabaseProductionData = {
  tracks: readonly SupabaseTrack[];
  playlists: readonly SupabasePlaylist[];
  playlistTracks: readonly SupabasePlaylistTrack[];
};

function normalizeImage(track: SupabaseTrack) {
  if (track.image === null) {
    return { src: "/icon.svg", alt: track.title };
  }

  return imageSchema.parse(track.image);
}

export function transformSupabaseProductionData(
  data: SupabaseProductionData
): MigrationData {
  const tracks = data.tracks
    .map((track) => ({
      publicId: track.id,
      title: track.title,
      artist: track.artist,
      record: track.record ?? "",
      src: track.src,
      image: normalizeImage(track),
      isLoop: track.isLoop,
      createdAt: track.created_at,
      updatedAt: track.created_at,
    }))
    .sort((left, right) => left.publicId - right.publicId);
  const playlists = data.playlists
    .map((playlist) => ({
      publicId: playlist.id,
      title: playlist.title,
      ...(playlist.description === null
        ? {}
        : { description: playlist.description }),
      createdAt: playlist.created_at,
      updatedAt: playlist.created_at,
    }))
    .sort((left, right) => left.publicId - right.publicId);
  const playlistTracks = data.playlistTracks
    .map((playlistTrack) => ({
      playlistId: playlistTrack.playlist_id,
      trackId: playlistTrack.track_id,
      position: playlistTrack.position,
      createdAt: playlistTrack.created_at,
    }))
    .sort(
      (left, right) =>
        left.playlistId - right.playlistId || left.position - right.position
    );
  const transformed = { tracks, playlists, playlistTracks };

  validateMigrationData(transformed);

  return transformed;
}

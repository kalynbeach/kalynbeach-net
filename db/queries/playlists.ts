import { PlaylistService } from "@/db/services/playlist-service";
import type { WavePlayerPlaylist, WavePlayerTrack } from "@/lib/types/wave-player";

/**
 * Get a playlist by ID with its tracks
 * @param playlistId - The ID of the playlist to get
 * @returns The playlist with tracks or null if not found
 */
export async function getPlaylist(playlistId: number): Promise<WavePlayerPlaylist | null> {
  const { playlist, tracks } = await PlaylistService.getWithTracks(playlistId);

  if (!playlist) return null;

  const wavePlayerTracks: WavePlayerTrack[] = tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    record: track.record || "",
    src: track.src,
    image: track.image as { src: string; alt: string },
    isLoop: track.isLoop,
  }));

  return {
    id: playlist.id,
    title: playlist.title,
    tracks: wavePlayerTracks,
    createdAt: new Date(playlist.created_at),
    updatedAt: new Date(playlist.created_at), // Using created_at since there's no updated_at field
  };
}

/**
 * Get all playlists with their tracks
 * @param limit - Maximum number of playlists to return
 * @param offset - Number of playlists to skip
 * @returns Array of playlists with their tracks
 */
export async function getAllPlaylists(limit: number = 10, offset: number = 0): Promise<WavePlayerPlaylist[]> {
  const playlists = await PlaylistService.list(limit, offset);
  
  // For the playlist listing, we'll fetch all playlists with their tracks
  return Promise.all(
    playlists.map(async (playlist) => {
      const fullPlaylist = await getPlaylist(playlist.id);
      return fullPlaylist!;
    })
  );
} 
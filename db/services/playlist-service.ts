import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables } from "@/lib/types/database";

/**
 * Service for playlist-related database operations
 */
export class PlaylistService extends BaseService {
  /**
   * Get playlists from the database
   * @param limit - The number of playlists to get
   * @param offset - The offset of the playlists to get
   * @returns Array of playlists
   */
  static list = cache(async (limit: number = 10, offset: number = 0): Promise<Tables<"playlists">[]> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("playlists")
      .select("*", { count: "exact" })
      .range(offset, offset + limit);

    this.handleError(error, "fetching playlists");

    return data || [];
  });

  /**
   * Get a playlist by ID including its tracks
   * @param playlistId - The ID of the playlist to get
   * @returns Playlist and its tracks
   */
  static getWithTracks = cache(async (playlistId: number): Promise<{
    playlist: Tables<"playlists"> | null;
    tracks: Tables<"tracks">[];
  }> => {
    const supabase = await this.getClient();

    // Get the playlist
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    this.handleError(playlistError, `fetching playlist ${playlistId}`);

    if (!playlist) {
      return { playlist: null, tracks: [] };
    }

    // Get the playlist tracks with their positions
    const { data: playlistTracks, error: tracksError } = await supabase
      .from("playlist_tracks")
      .select(`
        position,
        tracks:track_id(*)
      `)
      .eq("playlist_id", playlistId)
      .order("position");

    this.handleError(tracksError, `fetching tracks for playlist ${playlistId}`);

    // Extract tracks and maintain their order
    const tracks = playlistTracks 
      ? playlistTracks.map(item => item.tracks as Tables<"tracks">)
      : [];

    return { playlist, tracks };
  });

  /**
   * Add a track to a playlist
   * @param playlistId - The ID of the playlist
   * @param trackId - The ID of the track to add
   * @param position - The position in the playlist (optional, will append to end if not specified)
   * @returns Success indicator
   */
  static addTrack = async (
    playlistId: number, 
    trackId: number, 
    position?: number
  ): Promise<boolean> => {
    const supabase = await this.getClient();
    
    // If position isn't specified, put it at the end
    if (position === undefined) {
      const { count, error: countError } = await supabase
        .from("playlist_tracks")
        .select("*", { count: "exact" })
        .eq("playlist_id", playlistId);
      
      this.handleError(countError, `counting tracks in playlist ${playlistId}`);
      position = (count || 0) + 1;
    }

    const { error } = await supabase
      .from("playlist_tracks")
      .insert({
        playlist_id: playlistId,
        track_id: trackId,
        position
      });

    this.handleError(error, `adding track ${trackId} to playlist ${playlistId}`);
    return !error;
  };

  /**
   * Remove a track from a playlist
   * @param playlistId - The ID of the playlist
   * @param trackId - The ID of the track to remove
   * @returns Success indicator
   */
  static removeTrack = async (
    playlistId: number, 
    trackId: number
  ): Promise<boolean> => {
    const supabase = await this.getClient();
    
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .match({
        playlist_id: playlistId,
        track_id: trackId
      });

    this.handleError(error, `removing track ${trackId} from playlist ${playlistId}`);
    return !error;
  };

  /**
   * Reorder a track in a playlist
   * @param playlistId - The ID of the playlist
   * @param trackId - The ID of the track to reorder
   * @param newPosition - The new position for the track
   * @returns Success indicator
   */
  static reorderTrack = async (
    playlistId: number, 
    trackId: number, 
    newPosition: number
  ): Promise<boolean> => {
    const supabase = await this.getClient();
    
    const { error } = await supabase
      .from("playlist_tracks")
      .update({ position: newPosition })
      .match({
        playlist_id: playlistId,
        track_id: trackId
      });

    this.handleError(error, `reordering track ${trackId} in playlist ${playlistId}`);
    return !error;
  };
} 
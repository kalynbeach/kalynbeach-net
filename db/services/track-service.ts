import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

/**
 * Service for track-related database operations
 */
export class TrackService extends BaseService {
  /**
   * Get tracks from the database
   * @param limit - The number of tracks to get
   * @param offset - The offset of the tracks to get
   * @returns Array of tracks
   */
  static list = cache(async (limit: number = 10, offset: number = 0): Promise<Tables<"tracks">[]> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("tracks")
      .select("*", { count: "exact" })
      .range(offset, offset + limit);

    this.handleError(error, "fetching tracks");

    return data || [];
  });

  /**
   * Get a single track by ID
   * @param trackId - The ID of the track to get
   * @returns The track or null if not found
   */
  static getTrack = cache(async (trackId: number): Promise<Tables<"tracks"> | null> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("id", trackId)
      .single();

    this.handleError(error, `fetching track ${trackId}`);

    return data;
  });

  /**
   * Add a new track to the database
   * @param track - The track data to insert
   * @returns The ID of the newly created track or null if creation failed
   */
  static addTrack = async (track: TablesInsert<"tracks">): Promise<number | null> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("tracks")
      .insert(track)
      .select("id")
      .single();

    this.handleError(error, "adding track");
    this.logOperation("Add track", { track });

    return data?.id || null;
  };

  /**
   * Remove a track from the database
   * @param trackId - The ID of the track to remove
   * @returns Success indicator
   */
  static removeTrack = async (trackId: number): Promise<boolean> => {
    const supabase = await this.getClient();

    // First check if the track is used in any playlists
    const { count, error: checkError } = await supabase
      .from("playlist_tracks")
      .select("*", { count: "exact" })
      .eq("track_id", trackId);

    this.handleError(checkError, `checking if track ${trackId} is used in playlists`);

    if (count && count > 0) {
      console.warn(`Track ${trackId} is used in ${count} playlists and cannot be deleted directly`);
      return false;
    }

    // If track is not used in playlists, delete it
    const { error } = await supabase
      .from("tracks")
      .delete()
      .eq("id", trackId);

    this.handleError(error, `removing track ${trackId}`);
    this.logOperation("Remove track", { trackId });

    return !error;
  };

  /**
   * Update a track in the database
   * @param trackId - The ID of the track to update
   * @param trackData - The track data to update
   * @returns Success indicator
   */
  static updateTrack = async (
    trackId: number,
    trackData: TablesUpdate<"tracks">
  ): Promise<boolean> => {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from("tracks")
      .update(trackData)
      .eq("id", trackId);

    this.handleError(error, `updating track ${trackId}`);
    this.logOperation("Update track", { trackId, trackData });

    return !error;
  };
}
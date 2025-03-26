import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables } from "@/lib/types/database";

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
}
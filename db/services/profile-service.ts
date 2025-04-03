import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

/**
 * Service for user profile-related database operations
 */
export class ProfileService extends BaseService {
  /**
   * Get user profiles from the database
   * @param limit - The number of profiles to get
   * @param offset - The offset of the profiles to get
   * @returns Array of profiles
   */
  static list = cache(async (limit: number = 10, offset: number = 0): Promise<Tables<"profiles">[]> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .range(offset, offset + limit);

    this.handleError(error, "fetching profiles");

    return data || [];
  });

  /**
   * Get a single user profile by ID
   * @param profileId - The ID of the profile to get
   * @returns The profile or null if not found
   */
  static getProfile = cache(async (profileId: string): Promise<Tables<"profiles"> | null> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    this.handleError(error, `fetching profile ${profileId}`);

    return data;
  });

  /**
   * Add a new profile to the database
   * @param profile - The profile data to insert
   * @returns The ID of the newly created profile or null if creation failed
   */
  static addProfile = async (profile: TablesInsert<"profiles">): Promise<string | null> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("profiles")
      .insert(profile)
      .select("id")
      .single();

    this.handleError(error, "adding profile");
    this.logOperation("Add profile", { profile });

    return data?.id || null;
  };

  /**
   * Remove a user profile from the database
   * @param profileId - The ID of the profile to remove
   * @returns Success indicator
   */
  static removeProfile = async (profileId: string): Promise<boolean> => {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);

    this.handleError(error, `removing profile ${profileId}`);
    this.logOperation("Remove profile", { profileId });

    return !error;
  };

  /**
   * Update a user profile in the database
   * @param profileId - The ID of the profile to update
   * @param profileData - The profile data to update
   * @returns Success indicator
   */
  static updateProfile = async (
    profileId: string,
    profileData: TablesUpdate<"profiles">
  ): Promise<boolean> => {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from("profiles")
      .update(profileData)
      .eq("id", profileId);

    this.handleError(error, `updating profile ${profileId}`);
    this.logOperation("Update profile", { profileId, profileData });

    return !error;
  };
}
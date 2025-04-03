import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

/**
 * Service for user-related database operations
 */
export class UserService extends BaseService {
  /**
   * Get users from the database
   * @param limit - The number of users to get
   * @param offset - The offset of the users to get
   * @returns Array of users
   */
  // static list = cache(async (limit: number = 10, offset: number = 0): Promise<Tables<"users">[]> => {
  //   const supabase = await this.getClient();

  //   const { data, error } = await supabase
  //     .from("users")
  //     .select("*", { count: "exact" })
  //     .range(offset, offset + limit);

  //   this.handleError(error, "fetching users");

  //   return data || [];
  // });

  /**
   * Get a single user by ID
   * @param userId - The ID of the user to get
   * @returns The user or null if not found
   */
  // static getUser = cache(async (userId: number): Promise<Tables<"users"> | null> => {
  //   const supabase = await this.getClient();

  //   const { data, error } = await supabase
  //     .from("users")
  //     .select("*")
  //     .eq("id", userId)
  //     .single();

  //   this.handleError(error, `fetching user ${userId}`);

  //   return data;
  // });

  /**
   * Add a new user to the database
   * @param user - The user data to insert
   * @returns The ID of the newly created user or null if creation failed
   */
  // static addUser = async (user: TablesInsert<"users">): Promise<number | null> => {
  //   const supabase = await this.getClient();

  //   const { data, error } = await supabase
  //     .from("users")
  //     .insert(user)
  //     .select("id")
  //     .single();

  //   this.handleError(error, "adding user");
  //   this.logOperation("Add user", { user });

  //   return data?.id || null;
  // };

  /**
   * Remove a user from the database
   * @param userId - The ID of the user to remove
   * @returns Success indicator
   */
  // static removeUser = async (userId: number): Promise<boolean> => {
  //   const supabase = await this.getClient();

  //   const { error } = await supabase
  //     .from("users")
  //     .delete()
  //     .eq("id", userId);

  //   this.handleError(error, `removing user ${userId}`);
  //   this.logOperation("Remove user", { userId });

  //   return !error;
  // };

  /**
   * Update a user in the database
   * @param userId - The ID of the user to update
   * @param userData - The user data to update
   * @returns Success indicator
   */
  // static updateUser = async (
  //   userId: number,
  //   userData: TablesUpdate<"users">
  // ): Promise<boolean> => {
  //   const supabase = await this.getClient();

  //   const { error } = await supabase
  //     .from("users")
  //     .update(userData)
  //     .eq("id", userId);

  //   this.handleError(error, `updating user ${userId}`);
  //   this.logOperation("Update user", { userId, userData });

  //   return !error;
  // };
}
import { cache } from "react";
import { BaseService } from "@/db/services/base-service";
import type { Tables } from "@/lib/types/database";

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
  static list = cache(async (limit: number = 10, offset: number = 0): Promise<Tables<"users">[]> => {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from("users")
      .select("*", { count: "exact" })
      .range(offset, offset + limit);

    this.handleError(error, "fetching users");

    return data || [];
  });
}
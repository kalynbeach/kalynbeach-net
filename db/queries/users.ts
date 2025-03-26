import { UserService } from "@/db/services/user-service";
import type { Tables } from "@/lib/types/database";

/**
 * Get users from the Supabase Postgres database
 * @param limit - The number of users to get
 * @param offset - The offset of the users to get
 * @returns The users from the database
 */
export async function getUsers(limit: number = 10, offset: number = 0): Promise<Tables<"users">[]> {
  const users = await UserService.list(limit, offset);
  return users;
}

import { cache } from "react";
import type { Tables } from "@/lib/types/database";
import { createSupabaseServerClient } from "@/db/supabase/server";

/**
 * Get users from the Supabase Postgres database
 * @param limit - The number of users to get
 * @param offset - The offset of the users to get
 * @returns The users from the database
 */
export const getUsers = cache(
  async (limit: number = 10, offset: number = 0): Promise<Tables<"users">[]> => {
    const supabase = await createSupabaseServerClient();

    const usersQuery = supabase
      .from("users")
      .select("*", { count: "exact" })
      .range(offset, offset + limit);

    const { data, error } = await usersQuery;

    if (error) {
      throw error;
    }

    return data;
  }
);

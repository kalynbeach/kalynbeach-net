import type { QueryResult, QueryData, QueryError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/db/supabase/server";

export async function getUsers(limit: number = 10, offset: number = 0) {
  console.log(`[getUsers] querying users - limit: ${limit} offset: ${offset}`);
  const supabase = await createSupabaseServerClient();

  const usersQuery = supabase
    .from("users")
    .select("*", { count: "exact" })
    .range(offset, offset + limit);

  type Users = QueryData<typeof usersQuery>;

  const { data, error } = await usersQuery;

  if (error) {
    throw error;
  }

  const users: Users = data;

  return users;
}

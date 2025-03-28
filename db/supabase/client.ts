"use client";

import type { Database } from "@/lib/types/database";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "./env.client";

/**
 * Creates a Supabase client for use in client components
 * This client is used for real-time subscriptions and client-side data access
 */
export function createSupabaseClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        fetch: fetch.bind(window),
      },
      auth: {
        persistSession: false, // We're using Auth.js, so we don't need Supabase Auth session persistence
      },
    }
  );
}

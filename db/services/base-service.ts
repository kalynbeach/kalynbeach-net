import { cache } from "react";
import { createSupabaseServerClient } from "@/db/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Base service class with common functionality for database services
 * Provides error handling, logging, and caching utilities
 */
export class BaseService {
  /**
   * Get a cached Supabase client for server-side operations
   */
  protected static getClient = cache(() => {
    return createSupabaseServerClient();
  });

  /**
   * Handle Supabase errors consistently
   * @param error - The error to handle
   * @param context - Additional context for logging
   */
  protected static handleError(
    error: PostgrestError | null,
    context: string
  ): void {
    if (error) {
      console.error(`[Database Error] ${context}:`, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
  }

  /**
   * Log database operations in development
   * @param operation - The operation being performed
   * @param details - Additional details about the operation
   */
  protected static logOperation(
    operation: string,
    details?: Record<string, any>
  ): void {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Database] ${operation}`, details || "");
    }
  }
}

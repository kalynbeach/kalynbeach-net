import { z } from "zod";

/**
 * Server-side environment variables schema
 */
const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),

  // Node environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

/**
 * Client-side environment variables schema
 * Only include variables that are safe to expose to the client
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Parse and validate environment variables
 * @param schema - Zod schema to validate against
 * @param env - Environment variables object
 * @returns Validated environment variables
 */
function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined>
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    console.error(
      "❌ Invalid environment variables:",
      result.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables");
  }

  return result.data;
}

/**
 * Server-side environment variables
 * Available only on the server
 */
export const serverEnv = validateEnv(serverSchema, process.env);

/**
 * Client-side environment variables
 * Safe to expose to the client
 */
export const clientEnv = validateEnv(clientSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Combined environment variables
 * Use this in server components and API routes
 */
export const env = {
  ...serverEnv,
  ...clientEnv,
};

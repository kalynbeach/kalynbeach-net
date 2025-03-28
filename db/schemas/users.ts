import { z } from "zod";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

/**
 * Schema for user roles
 */
export const userRoleSchema = z.enum(["admin", "vip", "guest"]);

/**
 * Schema for database user data (as it exists in the database)
 */
export const dbUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: userRoleSchema,
  created_at: z.string(),
});

/**
 * Schema for application user data
 */
export const appUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: userRoleSchema,
  createdAt: z.date(),
});

/**
 * Schema for user data when creating a new user
 */
export const userInsertSchema = z.object({
  email: z.string().email(),
  role: userRoleSchema,
});

/**
 * Schema for user data when updating an existing user
 */
export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
});

/**
 * Transform a database user to an application user
 */
export function dbUserToAppUser(dbUser: Tables<"users">) {
  return appUserSchema.parse({
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    createdAt: new Date(dbUser.created_at),
  });
}

/**
 * Transform an application user to a database user (for insert)
 */
export function appUserToDbUser(user: Omit<z.infer<typeof appUserSchema>, "id" | "createdAt">): TablesInsert<"users"> {
  return {
    email: user.email,
    role: user.role,
  };
}

/**
 * Transform a partial application user to a database user update
 */
export function appUserUpdateToDbUserUpdate(
  userUpdate: Partial<Omit<z.infer<typeof appUserSchema>, "id" | "createdAt">>
): TablesUpdate<"users"> {
  const dbUpdate: TablesUpdate<"users"> = {};

  if (userUpdate.email !== undefined) dbUpdate.email = userUpdate.email;
  if (userUpdate.role !== undefined) dbUpdate.role = userUpdate.role;

  return dbUpdate;
}

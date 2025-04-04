import type { z } from "zod";
import type { appUserSchema } from "@/db/schemas/users";
import { UserService } from "@/db/services/user-service";
// import { dbUserToAppUser, appUserToDbUser, appUserUpdateToDbUserUpdate } from "@/db/schemas/users";

/**
 * Get users from the Supabase Postgres database
 * @param limit - The number of users to get
 * @param offset - The offset of the users to get
 * @returns The users from the database
 */
// export async function getUsers(limit: number = 10, offset: number = 0): Promise<z.infer<typeof appUserSchema>[]> {
//   const users = await UserService.list(limit, offset);
//   return users.map(dbUserToAppUser);
// }

/**
 * Get a single user by ID
 * @param userId - The ID of the user to get
 * @returns The user or null if not found
 */
// export async function getUser(userId: number): Promise<z.infer<typeof appUserSchema> | null> {
//   const user = await UserService.getUser(userId);
//   if (!user) return null;
  
//   return dbUserToAppUser(user);
// }

/**
 * Add a new user to the database
 * @param userData - The user data to insert
 * @returns The ID of the newly created user or null if creation failed
 */
// export async function addUser(userData: Omit<z.infer<typeof appUserSchema>, "id" | "createdAt">): Promise<number | null> {
//   const dbUser = appUserToDbUser(userData);
//   return UserService.addUser(dbUser);
// }

/**
 * Remove a user from the database
 * @param userId - The ID of the user to remove
 * @returns Success indicator
 */
// export async function removeUser(userId: number): Promise<boolean> {
//   return UserService.removeUser(userId);
// }

/**
 * Update a user in the database
 * @param userId - The ID of the user to update
 * @param userData - The user data to update
 * @returns Success indicator
 */
// export async function updateUser(
//   userId: number,
//   userData: Partial<Omit<z.infer<typeof appUserSchema>, "id" | "createdAt">>
// ): Promise<boolean> {
//   const dbUserUpdate = appUserUpdateToDbUserUpdate(userData);
//   return UserService.updateUser(userId, dbUserUpdate);
// }

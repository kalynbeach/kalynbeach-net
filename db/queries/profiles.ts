import type { Tables } from "@/lib/types/database";
import { ProfileService } from "@/db/services/profile-service";

export async function getProfile(id: string): Promise<Tables<"profiles"> | null> {
  const profile = await ProfileService.getProfile(id);
  return profile;
}
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  toWavePlayerPlaylist,
  toWavePlayerTrack,
} from "@/lib/convex/wave-player";
import type {
  WavePlayerPlaylist,
  WavePlayerTrack,
} from "@/lib/types/wave-player";

const CONVEX_JWT_TEMPLATE = "convex";

async function getConvexToken(): Promise<string | null> {
  const { userId, getToken } = await auth();

  if (!userId) {
    return null;
  }

  const token = await getToken({ template: CONVEX_JWT_TEMPLATE });

  if (!token) {
    throw new Error("Clerk did not issue the Convex JWT template");
  }

  return token;
}

export async function requireConvexAdmin(): Promise<void> {
  const token = await getConvexToken();

  if (!token) {
    redirect("/login");
  }

  let access = await fetchMutation(api.users.ensureCurrent, {}, { token });

  if (access.role !== "admin") {
    access = await fetchMutation(api.users.claimConfiguredAdmin, {}, { token });
  }

  if (access.role !== "admin") {
    redirect("/auth/unauthorized");
  }

  await fetchQuery(api.users.adminAuthorization, {}, { token });
}

export async function getWavePlayerPlaylist(
  playlistId: number
): Promise<WavePlayerPlaylist | null> {
  const playlist = await fetchQuery(api.playlists.getById, { id: playlistId });

  return playlist ? toWavePlayerPlaylist(playlist) : null;
}

export async function getWavePlayerTracks(
  limit = 100
): Promise<WavePlayerTrack[]> {
  const tracks = await fetchQuery(api.tracks.list, { limit });

  return tracks.map(toWavePlayerTrack);
}

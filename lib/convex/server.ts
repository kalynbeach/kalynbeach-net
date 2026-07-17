import "server-only";

import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getConvexToken } from "@/lib/convex/clerk-token";
import {
  toWavePlayerPlaylist,
  toWavePlayerTrack,
} from "@/lib/convex/wave-player";
import type {
  WavePlayerPlaylist,
  WavePlayerTrack,
} from "@/lib/types/wave-player";

export async function requireConvexAdmin(): Promise<void> {
  const { userId, sessionClaims, getToken } = await auth();
  const token = await getConvexToken({ userId, sessionClaims, getToken });

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

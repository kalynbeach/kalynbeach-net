import type { NextRequest } from "next/server";
import { getWavePlayerPlaylist } from "@/lib/convex/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({ error: "Invalid playlist id" }, { status: 400 });
  }

  const playlist = await getWavePlayerPlaylist(id);

  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  return Response.json(playlist);
}

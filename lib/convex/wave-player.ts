import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type {
  WavePlayerPlaylist,
  WavePlayerTrack,
} from "@/lib/types/wave-player";

type ConvexPlaylist = NonNullable<
  FunctionReturnType<typeof api.playlists.getById>
>;
type ConvexTrack = FunctionReturnType<typeof api.tracks.list>[number];

export function toWavePlayerTrack(track: ConvexTrack): WavePlayerTrack {
  return track;
}

export function toWavePlayerPlaylist(
  playlist: ConvexPlaylist
): WavePlayerPlaylist {
  return {
    ...playlist,
    tracks: playlist.tracks.map(toWavePlayerTrack),
    createdAt: new Date(playlist.createdAt),
    updatedAt: new Date(playlist.updatedAt),
  };
}

import { TrackService } from "@/db/services/track-service";
import type { WavePlayerTrack } from "@/lib/types/wave-player";

export async function getTracks(limit: number = 10, offset: number = 0): Promise<WavePlayerTrack[]> {
  const tracks = await TrackService.list(limit, offset);

  const wavePlayerTracks: WavePlayerTrack[] = tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    record: track.record || "",
    src: track.src,
    image: track.image as { src: string; alt: string },
    isLoop: track.isLoop,
  }));

  return wavePlayerTracks;
}
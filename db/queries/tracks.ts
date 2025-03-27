import { TrackService } from "@/db/services/track-service";
import { dbTrackToWavePlayerTrack, wavePlayerTrackToDbTrack, wavePlayerTrackUpdateToDbTrackUpdate } from "@/db/schemas/tracks";
import type { WavePlayerTrack } from "@/lib/types/wave-player";

/**
 * Get tracks from the database
 * @param limit - The number of tracks to get
 * @param offset - The offset of the tracks to get
 * @returns Array of tracks in WavePlayerTrack format
 */
export async function getTracks(limit: number = 10, offset: number = 0): Promise<WavePlayerTrack[]> {
  const tracks = await TrackService.list(limit, offset);
  return tracks.map(dbTrackToWavePlayerTrack);
}

/**
 * Get a single track by ID
 * @param trackId - The ID of the track to get
 * @returns The track in WavePlayerTrack format or null if not found
 */
export async function getTrack(trackId: number): Promise<WavePlayerTrack | null> {
  const track = await TrackService.getTrack(trackId);
  if (!track) return null;
  
  return dbTrackToWavePlayerTrack(track);
}

/**
 * Add a new track to the database
 * @param trackData - The track data to insert
 * @returns The ID of the newly created track or null if creation failed
 */
export async function addTrack(trackData: Omit<WavePlayerTrack, "id">): Promise<number | null> {
  const dbTrack = wavePlayerTrackToDbTrack(trackData);
  return TrackService.addTrack(dbTrack);
}

/**
 * Remove a track from the database
 * @param trackId - The ID of the track to remove
 * @returns Success indicator
 */
export async function removeTrack(trackId: number): Promise<boolean> {
  return TrackService.removeTrack(trackId);
}

/**
 * Update a track in the database
 * @param trackId - The ID of the track to update
 * @param trackData - The track data to update
 * @returns Success indicator
 */
export async function updateTrack(
  trackId: number,
  trackData: Partial<Omit<WavePlayerTrack, "id">>
): Promise<boolean> {
  const dbTrackUpdate = wavePlayerTrackUpdateToDbTrackUpdate(trackData);
  return TrackService.updateTrack(trackId, dbTrackUpdate);
}
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTracks } from "@/db/queries/tracks";
import { getPlaylist } from "@/db/queries/playlists";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
import WavePlayer from "@/components/wave-player/wave-player";
import SitePageHeader from "@/components/site/site-page-header";

export const metadata: Metadata = {
  title: "wave-player",
};

/**
 * Get the initial playlist for the wave player
 * Attempts to fetch playlist with ID 1, falls back to track list if not found
 */
async function getInitialPlaylist() {
  // Try to get the first playlist
  const playlist = await getPlaylist(1);
  
  if (playlist) {
    return playlist;
  }
  
  // Fallback: Create a temporary playlist from all tracks
  const initialTracks = await getTracks();

  const fallbackPlaylist: WavePlayerPlaylist = {
    id: 0,
    title: "all",
    tracks: initialTracks,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return fallbackPlaylist;
}

// TODO: optimize WavePlayer rendering in WavePlayerPage
export default async function WavePlayerPage() {
  const playlist = await getInitialPlaylist();

  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader />
      {/* <h2 className="text-xl font-mono">WavePlayer</h2> */}
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <WavePlayerProvider playlist={playlist}>
            <WavePlayer />
          </WavePlayerProvider>
        </Suspense>
      </div>
    </div>
  );
}

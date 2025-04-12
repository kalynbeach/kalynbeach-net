import type { Metadata } from "next";
// import dynamic from "next/dynamic";
import { cache, Suspense } from "react";
import { getTracks } from "@/db/queries/tracks";
import { getPlaylist } from "@/db/queries/playlists";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
import SitePage from "@/components/site/site-page";
import WavePlayer from "@/components/wave-player/wave-player";

// const WavePlayer = dynamic(() => import("@/components/wave-player/wave-player"));

export const metadata: Metadata = {
  title: "wave-player",
};

/**
 * Get the initial playlist for the `WavePlayer` component.
 * Attempts to fetch playlist with ID 1, falls back to track list if not found.
 */
const getInitialPlaylist = cache(async (): Promise<WavePlayerPlaylist> => {
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
});

// TODO: optimize WavePlayer rendering in WavePlayerPage
export default async function WavePlayerPage() {
  const playlist = await getInitialPlaylist();

  return (
    <SitePage>
      <main className="size-full flex flex-col items-center justify-center">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <WavePlayerProvider playlist={playlist}>
            <WavePlayer />
          </WavePlayerProvider>
        </Suspense>
      </main>
    </SitePage>
  );
}

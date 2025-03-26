import { Suspense } from "react";
import { getTracks } from "@/db/queries/tracks";
import type { WavePlayerPlaylist } from "@/lib/types/wave-player";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
import WavePlayer from "@/components/wave-player/wave-player";
import SitePageHeader from "@/components/site/site-page-header";

// TODO: implement proper functions for WavePlayer data fetching (playlists, tracks, etc.)
async function getPlaylist() {
  const initialTracks = await getTracks();

  // TODO: replace placeholder playlist
  const TEST_PLAYLIST: WavePlayerPlaylist = {
    id: 1,
    title: "playlist_0",
    tracks: initialTracks,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return TEST_PLAYLIST;
}

// TODO: optimize WavePlayer rendering in WavePlayerPage
export default async function WavePlayerPage() {
  const playlist = await getPlaylist();

  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="Sound" />
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

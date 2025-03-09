import { Suspense } from "react";
import type { WavePlayerTrack, WavePlayerPlaylist } from "@/lib/types/wave-player";
import { WavePlayerProvider } from "@/contexts/wave-player-context";
import WavePlayer from "@/components/wave-player/wave-player";
import SitePageHeader from "@/components/site/site-page-header";

// TODO: implement proper functions for WavePlayer data fetching (playlists, tracks, etc.)
async function getPlaylist() {
  // TODO: replace placeholder tracks
  const TEST_TRACKS: WavePlayerTrack[] = [
    {
      id: 1,
      title: "0_initializer",
      artist: "Kalyn Beach",
      record: "loops",
      src: "https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav",
      image: {
        src: "/icon.svg",
        alt: "0_initializer",
      },
      isLoop: true,
    },
    {
      id: 2,
      title: '1_workflows',
      artist: 'Kalyn Beach',
      record: 'loops',
      src: 'https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/1_workflows.wav',
      image: {
        src: '/globe.svg',
        alt: 'workflows',
      },
      isLoop: true,
    },
  ];

  // TODO: replace placeholder playlist
  const TEST_PLAYLIST: WavePlayerPlaylist = {
    id: 1,
    title: "playlist_0",
    tracks: TEST_TRACKS,
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
      <h2 className="text-xl font-mono">WavePlayer</h2>
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

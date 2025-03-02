import { NextRequest } from "next/server";
import type { WavePlayerTrack, WavePlayerPlaylist } from "@/lib/types/wave-player";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[api/playlists/[id]] request");
  const id = (await params).id;
  console.log("[api/playlists/[id]] id:", id);

  // TODO: fetch playlist (and tracks) from database

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

  return new Response(JSON.stringify(TEST_PLAYLIST), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
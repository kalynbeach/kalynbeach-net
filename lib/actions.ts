import type { WavePlayerTrack } from "@/lib/types";

// TODO: implement
export async function getWavePlayerTracks() {

  // TEMP
  const initialTracks: WavePlayerTrack[] = [
    {
      id: 1,
      title: '0_initializer',
      artist: 'Kalyn Beach',
      record: 'loops',
      src: 'https://kkb-sounds.s3.us-west-1.amazonaws.com/loops/0_initializer.wav',
      image: {
        src: '/kb_sphere.png',
        alt: 'initializer',
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
        src: '/kb_sphere.png',
        alt: 'workflows',
      },
      isLoop: true,
    },
  ];

  return initialTracks;
}
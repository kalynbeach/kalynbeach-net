import { useEffect, useRef, useState } from "react";
import { WavePlayerTrack } from "@/lib/types";

export function useWavePlayer(tracks: WavePlayerTrack[]) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // TODO: implement `initializeWavePlayer` useEffect

  // TODO: implement track controls
}
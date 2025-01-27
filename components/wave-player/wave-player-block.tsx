"use client";

import { useEffect } from "react";
import { useWavePlayerContext, TEST_PLAYLIST } from "@/contexts/wave-player-context";
import WavePlayer from "./wave-player";

export default function WavePlayerBlock() {
  const { state, controls, initialize, cleanup } = useWavePlayerContext();

  return (
    <div className="wave-player-block">
      <WavePlayer playlist={TEST_PLAYLIST} />
    </div>
  );
}
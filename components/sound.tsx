"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { SoundCardSkeleton } from "@/components/sound-card-skeleton";

const SoundCard = dynamic(
  () =>
    import("@/components/sound-card").then(
      (mod) => mod.SoundCard
    ),
  {
    ssr: false,
    loading: () => <SoundCardSkeleton />,
  }
);

export function Sound() {
  return (
    <Suspense fallback={<SoundCardSkeleton />}>
      <SoundCard />
    </Suspense>
  );
}

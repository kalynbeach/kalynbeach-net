import { Suspense } from "react";
import SitePage from "@/components/site/site-page";
import { Sound } from "@/components/sound";
import { SoundCardSkeleton } from "@/components/sound-card-skeleton";

export default function SoundBlockPage() {
  return (
    <SitePage>
      <main className="size-full flex flex-col items-center justify-center gap-4">
        <Suspense fallback={<SoundCardSkeleton />}>
          <Sound />
        </Suspense>
      </main>
    </SitePage>
  );
}

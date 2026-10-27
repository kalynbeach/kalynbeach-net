import { pageMetadata } from "@/lib/site";
import { WavePlayerCard } from "@/components/wave-player";

/** Title, lede, glow and the Library in section 3 come from the "/music" entry. */
export const metadata = pageMetadata("/music");

export default function Music() {
  return (
    <div className="flex justify-center">
      <WavePlayerCard />
    </div>
  );
}

import { pageMetadata } from "@/lib/site";
import { WavePlayerCard } from "@/components/wave-player";

export const metadata = pageMetadata("/music");

export default function Music() {
  return (
    <div className="flex justify-center">
      <WavePlayerCard />
    </div>
  );
}

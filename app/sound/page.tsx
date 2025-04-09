import type { Metadata } from "next";
import Link from "next/link";
import SitePageHeader from "@/components/site/site-page-header";

export const metadata: Metadata = {
  title: "sound",
};

export default function Sound() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader />
      <main>
        <ul className="list-disc list-inside">
          <li>
            <Link
              href="/sound/wave-player"
              className="font-mono transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green"
            >
              WavePlayer
            </Link>
          </li>
          <li>
            <Link
              href="/sound/wave-lab"
              className="font-mono transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green"
            >
              WaveLab
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}

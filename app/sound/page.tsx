import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "sound",
};

export default function Sound() {
  return (
    <SitePage>
      <main className="size-full flex flex-col gap-4">
        <ul className="list-disc list-inside">
          <li>
            <Link
              href="/sound/sound-card"
              className="font-mono font-medium transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green"
            >
              SoundCard
            </Link>
          </li>
          {/* <li>
            <Link
              href="/sound/wave-lab"
              className="font-mono font-medium transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green"
            >
              WaveLab
            </Link>
          </li> */}
        </ul>
      </main>
    </SitePage>
  );
}

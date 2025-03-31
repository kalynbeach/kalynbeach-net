import Link from "next/link";
import Image from "next/image";
import SiteNav from "./site-nav";
import SiteNavDrawer from "./site-nav-drawer";
import SiteCommandMenu from "./site-command-menu";
import type { SitePage } from "@/lib/types";

const siteNavPages: SitePage[] = [
  { label: "home", route: "/" },
  { label: "about", route: "/about" },
  { label: "tech", route: "/tech" },
  { label: "sound", route: "/sound" },
];

const commandMenuPages: SitePage[] = [
  ...siteNavPages,
  { label: "sound/wave-player", route: "/sound/wave-player" },
  { label: "sound/wave-lab", route: "/sound/wave-lab" },
  { label: "dashboard", route: "/dashboard" },
  { label: "lab", route: "/lab" },
];

export default function SiteHeader() {
  return (
    <header className="site-header w-full h-full flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <Image
          src="/icon.svg"
          alt="kb"
          width={36}
          height={36}
          className="w-9 h-9 rounded-full"
          priority
        />
        <Link href="/" className="text-lg sm:text-xl font-mono font-medium">
          kalynbeach
        </Link>
      </div>
      <SiteNav pages={siteNavPages} />
      <SiteNavDrawer pages={siteNavPages} />
      <SiteCommandMenu pages={commandMenuPages} />
    </header>
  );
}
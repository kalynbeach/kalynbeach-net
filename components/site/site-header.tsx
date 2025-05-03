import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/site/site-nav";
import SiteNavDrawer from "@/components/site/site-nav-drawer";
import SiteCommandMenu from "@/components/site/site-command-menu";
import SphereIcon from "@/components/site/icons/sphere-icon";
import type { SitePage } from "@/lib/types/site";

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
  { label: "style", route: "/style" },
  { label: "dashboard", route: "/dashboard" },
  { label: "lab", route: "/lab" },
];

export default function SiteHeader() {
  return (
    <header className="site-header w-full h-full flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        {/* <SphereIcon className="size-9 rounded-full" /> */}
        <Link href="/" className="text-xl font-mono font-bold underline underline-offset-2">
          kalynbeach
        </Link>
      </div>
      <SiteNav pages={siteNavPages} />
      <SiteNavDrawer pages={siteNavPages} />
      <SiteCommandMenu pages={commandMenuPages} />
    </header>
  );
}
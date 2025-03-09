"use client";

import { usePathname } from "next/navigation";
import type { SitePage } from "@/lib/types";
import SiteNavLink from "./site-nav-link";

type SiteNavProps = {
  pages: SitePage[];
};

export default function SiteNav({ pages }: SiteNavProps) {
  const pathname = usePathname();

  return (
    <nav className="site-nav hidden sm:flex flex-row items-center justify-between gap-3 sm:gap-5 ml-auto">
      {pages.slice(1).map((page) => (
        <SiteNavLink key={page.route} page={page} isActive={pathname.includes(page.route)} />
      ))}
    </nav>
  );
}
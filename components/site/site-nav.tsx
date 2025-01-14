"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SiteNavPage } from "@/lib/types";
import SiteCommandMenu from "./site-command-menu";

const pages: SiteNavPage[] = [
  { label: "home", route: "/" },
  { label: "code", route: "/code" },
  { label: "sound", route: "/sound" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav w-fit flex flex-row items-center justify-between gap-3 sm:gap-5">
      {pages.slice(1).map((page) => (
        <Link
          key={page.route}
          href={page.route}
          className={cn(
            "text-xs sm:text-sm font-mono font-semibold dark:font-normal",
            "transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green",
            `${pathname === page.route ? "text-kb-blue dark:text-kb-green" : ""}`
          )}
        >
          {page.label}
        </Link>
      ))}
      <SiteCommandMenu pages={pages} />
    </nav>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SiteNav() {
  const pathname = usePathname();

  // TODO: configure nav pages based on auth session?
  const pages = [
    { href: "/code", label: "code" },
    { href: "/sound", label: "sound" },
    // { href: "/dashboard", label: "dashboard" },
  ];

  return (
    <nav className="site-nav w-fit flex flex-row items-center justify-between gap-3">
      {pages.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className={cn(
            "text-xs sm:text-sm font-mono",
            "transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green",
            `${pathname === page.href ? "text-kb-blue dark:text-kb-green" : ""}`
          )}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
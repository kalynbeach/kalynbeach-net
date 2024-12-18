"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SiteNav() {
  const pathname = usePathname();

  // TODO: configure nav pages based on auth session?
  const pages = [
    { href: "/sound", label: "sound" },
    { href: "/code", label: "code" },
  ];

  return (
    <nav className="site-nav w-fit flex flex-row items-center justify-between gap-4">
      {pages.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className={cn(
            "text-xs md:text-sm font-mono tracking-wide",
            "transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green",
            `${pathname === page.href ? 'text-kb-blue dark:text-kb-green' : ''}`
          )}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
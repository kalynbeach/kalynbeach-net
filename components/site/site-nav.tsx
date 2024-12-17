import Link from "next/link";

export default function SiteNav() {
  // TODO: refactor this so it can be configured based on auth status
  const pages = [
    // { href: "/", label: "Home" },
    { href: "/sound", label: "sound" },
    { href: "/code", label: "code" },
  ];

  return (
    <nav className="site-nav w-fit flex flex-row items-center justify-between gap-4">
      {pages.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className="text-xs font-mono"
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
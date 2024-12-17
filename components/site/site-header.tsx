import Link from "next/link";
import SiteNav from "./site-nav";

export default function SiteHeader() {
  return (
    <header className="site-header w-full flex flex-row items-center justify-between">
      <Link href="/" className="font-mono">
        kalynbeach
      </Link>
      <SiteNav />
    </header>
  );
}
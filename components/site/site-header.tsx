import Link from "next/link";
import Image from "next/image";
import SiteNav from "./site-nav";

export default function SiteHeader() {
  return (
    <header className="site-header w-full h-full flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <Image
          src="/icon.svg"
          alt="kb"
          width={32}
          height={32}
          className="w-8 h-8 rounded-full"
          priority
        />
        <Link href="/" className="text-lg font-mono tracking-wide">
          kalynbeach
        </Link>
      </div>
      <SiteNav />
    </header>
  );
}
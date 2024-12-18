import Link from "next/link";
import Image from "next/image";
import SiteNav from "./site-nav";

export default function SiteHeader() {
  return (
    <header className="site-header w-full flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <Image
          src="/icon.svg"
          alt="kb"
          width={24}
          height={24}
          className="w-6 h-6 rounded-full"
        />
        <Link href="/" className="font-mono tracking-wide">
          kalynbeach
        </Link>
      </div>
      <SiteNav />
    </header>
  );
}
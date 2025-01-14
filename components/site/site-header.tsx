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
          width={36}
          height={36}
          className="w-9 h-9 rounded-full"
          priority
        />
        <Link href="/" className="text-lg sm:text-xl font-mono font-bold dark:font-normal">
          kalynbeach
        </Link>
      </div>
      <SiteNav />
    </header>
  );
}
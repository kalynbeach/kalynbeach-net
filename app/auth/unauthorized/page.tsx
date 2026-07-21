import type { Metadata } from "next";
import Link from "next/link";
import SiteAuth from "@/components/site/site-auth";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "unauthorized",
};

export default function Unauthorized() {
  return (
    <SitePage>
      <main className="flex size-full flex-col gap-4">
        <p className="font-mono text-sm font-medium">
          you do not have permission to access this page.
        </p>
        <SiteAuth />
        <Link href="/" className="font-mono text-sm font-medium underline">
          return home
        </Link>
      </main>
    </SitePage>
  );
}

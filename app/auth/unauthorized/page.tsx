import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import SiteAuth from "@/components/site/site-auth";

export const metadata = pageMetadata("/auth/unauthorized");

export default function Unauthorized() {
  return (
    <>
      <p className="font-mono text-sm font-medium">
        you do not have permission to access this page.
      </p>
      <SiteAuth />
      <Link href="/" className="font-mono text-sm font-medium underline">
        return home
      </Link>
    </>
  );
}

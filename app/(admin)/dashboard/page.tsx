import { Suspense } from "react";
import { pageMetadata } from "@/lib/site";
import SiteAuth from "@/components/site/site-auth";

export const metadata = pageMetadata("/dashboard");

export default function Dashboard() {
  return (
    <>
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <SiteAuth />
      </Suspense>
      <p className="font-mono text-sm">Convex admin access verified.</p>
    </>
  );
}

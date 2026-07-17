import type { Metadata } from "next";
import { Suspense } from "react";
import SitePage from "@/components/site/site-page";
import SiteAuth from "@/components/site/site-auth";

export const metadata: Metadata = {
  title: "dashboard",
};

export default function Dashboard() {
  return (
    <SitePage>
      <main className="flex size-full flex-col gap-4">
        <Suspense
          fallback={<div className="font-mono text-sm">loading...</div>}
        >
          <SiteAuth />
        </Suspense>
        <p className="font-mono text-sm">Convex admin access verified.</p>
      </main>
    </SitePage>
  );
}

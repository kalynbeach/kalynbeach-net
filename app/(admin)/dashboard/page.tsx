import { Suspense } from "react";
import { pageMetadata } from "@/lib/site";
import SiteAuth from "@/components/site/site-auth";
import { DashboardFrame } from "@/components/dashboard/frame";

export const metadata = pageMetadata("/dashboard");

export default function Dashboard() {
  return (
    <DashboardFrame
      account={
        <Suspense
          fallback={<div className="font-mono text-sm">loading...</div>}
        >
          <SiteAuth />
        </Suspense>
      }
    />
  );
}

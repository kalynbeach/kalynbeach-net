import { Suspense } from "react";
import SitePageHeader from "@/components/site/site-page-header";
import SiteAuth from "@/components/site/site-auth";

export default function Dashboard() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="dashboard" />
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <SiteAuth />
      </Suspense>
    </div>
  );
}

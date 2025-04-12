import type { Metadata } from "next";
import { Suspense } from "react";
import SitePage from "@/components/site/site-page";
import SiteAuth from "@/components/site/site-auth";

export const metadata: Metadata = {
  title: "login",
};

export default function Login() {
  return (
    <SitePage>
      <main className="size-full flex flex-col gap-4">
        <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
          <SiteAuth user={null} />
        </Suspense>  
      </main>
    </SitePage>
  );
}

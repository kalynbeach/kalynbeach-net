import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/db/supabase/server";
import { getProfile } from "@/db/queries/profiles";
import SitePageHeader from "@/components/site/site-page-header";
import SiteAuth from "@/components/site/site-auth";

export const metadata: Metadata = {
  title: "dashboard",
};

export default async function Dashboard() {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") {
    redirect("/auth/unauthorized");
  }
  
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader />
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <SiteAuth user={user} />
      </Suspense>
      <div className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xl font-mono font-semibold">Profile</p>
          <pre className="text-xs p-2 border border-accent bg-accent/10">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xl font-mono font-semibold">User</p>
          <pre className="text-xs p-2 border border-accent bg-accent/10">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/db/supabase/server";
import SitePageHeader from "@/components/site/site-page-header";
import SiteAuth from "@/components/site/site-auth";

// TODO: check if user is admin before rendering
export default async function Dashboard() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  if (error) {
    redirect("/login/error");
  }
  
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="dashboard" />
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <SiteAuth user={data.user} />
      </Suspense>
      <div className="w-full flex flex-col gap-2">
        <p className="text-xl font-mono">User</p>
        <pre className="text-xs p-2 border border-accent bg-accent/10">
          {JSON.stringify(data.user, null, 2)}
        </pre>
      </div>
    </div>
  );
}

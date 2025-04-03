import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/db/supabase/server";
import SiteSignIn from "@/components/site/site-sign-in";
import SiteSignOut from "@/components/site/site-sign-out";
// import SiteUser from "@/components/site/site-user";

type SiteAuthProps = {
  user: User | null;
}

export default async function SiteAuth({ user }: SiteAuthProps) {
  // const supabase = await createSupabaseServerClient();
  // const { data, error } = await supabase.auth.getUser();

  // if (error) {
  //   console.error("[SiteAuth] error:", error);
  //   // redirect("/login/error");
  // }

  return (
    <div className="site-auth w-full border border-muted p-1.5 rounded-md">
      {!user ? (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          <p className="text-xs font-mono font-medium">Protected Route</p>
          <SiteSignIn />
        </div>
      ) : (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          {/* <SiteUser user={data.user} /> */}
          <SiteSignOut />
        </div>
      )}
    </div>
  );
}
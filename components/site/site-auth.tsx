import type { User } from "@supabase/supabase-js";
import SiteSignIn from "@/components/site/site-sign-in";
import SiteSignOut from "@/components/site/site-sign-out";
import SiteUser from "@/components/site/site-user";

type SiteAuthProps = {
  user: User | null;
}

export default async function SiteAuth({ user }: SiteAuthProps) {
  return (
    <div className="site-auth w-fit border border-muted p-2">
      {!user ? (
        <div className="w-full flex flex-row items-center justify-between gap-6">
          <p className="text-xs font-mono font-medium">Protected Route</p>
          <SiteSignIn />
        </div>
      ) : (
        <div className="w-full flex flex-row items-center justify-between gap-6">
          <SiteUser user={user} />
          <SiteSignOut />
        </div>
      )}
    </div>
  );
}
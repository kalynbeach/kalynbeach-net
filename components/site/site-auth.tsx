import { auth } from "@/auth";
import SiteSignIn from "@/components/site/site-sign-in";
import SiteSignOut from "@/components/site/site-sign-out";
import SiteUser from "@/components/site/site-user";

export default async function SiteAuth() {
  const session = await auth();

  return (
    <div className="site-auth w-full border border-muted p-1.5 rounded-md">
      {!session?.user ? (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          <p className="text-xs font-mono font-medium">Protected Route</p>
          <SiteSignIn />
        </div>
      ) : (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          <SiteUser user={session.user} />
          <SiteSignOut />
        </div>
      )}
    </div>
  );
}
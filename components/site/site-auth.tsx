import { auth } from "@/auth";
import SignIn from "@/components/site/sign-in";
import SignOut from "@/components/site/sign-out";
import SiteUser from "@/components/site/site-user";

export default async function SiteAuth() {
  const session = await auth();

  return (
    <div className="site-auth w-full border border-muted p-1.5 rounded-md">
      {!session?.user ? (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          <p className="text-xs font-mono font-medium">Protected Route</p>
          <SignIn />
        </div>
      ) : (
        <div className="w-full flex flex-row items-center justify-between gap-2">
          <SiteUser user={session.user} />
          <SignOut />
        </div>
      )}
    </div>
  );
}
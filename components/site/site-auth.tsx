import { auth, signIn } from "@/auth";
import SignIn from "@/components/site/sign-in";
import SiteUser from "@/components/site/site-user";
import { Button } from "@/components/ui/button";

export default async function SiteAuth() {
  const session = await auth();

  return (
    <div className="site-auth">
      {!session?.user ? <SignIn /> : <SiteUser user={session.user} />}
    </div>
  );
}
import { auth } from "@/auth";
import SignIn from "@/components/site/sign-in";
import SiteUser from "@/components/site/site-user";

export default async function SiteAuth() {
  const session = await auth();

  return (
    <div className="site-auth flex flex-row items-center">
      {!session?.user ? (
        <SignIn />
      ) : (
        <SiteUser user={session.user} />
      )}
    </div>
  );
}
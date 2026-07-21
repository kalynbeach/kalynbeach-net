import { Show } from "@clerk/nextjs";
import SiteSignIn from "@/components/site/site-sign-in";
import SiteUser from "@/components/site/site-user";

export default function SiteAuth() {
  return (
    <div className="site-auth border-muted w-fit border p-2">
      <Show when="signed-out">
        <div className="flex w-full flex-row items-center justify-between gap-6">
          <p className="font-mono text-xs font-medium">Protected Route</p>
          <SiteSignIn />
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex w-full flex-row items-center justify-between gap-6">
          <SiteUser />
        </div>
      </Show>
    </div>
  );
}

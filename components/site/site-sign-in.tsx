import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function SiteSignIn() {
  return (
    <form
      action={async () => {
        "use server";
        // TODO: redirect to protected route that redirected to `/login` (`/dashboard` or `/sound`)
        await signIn("github", { redirectTo: "/dashboard" });
      }}
    >
      <Button type="submit" variant="outline" size="sm" className="">
        sign in
      </Button>
    </form>
  );
}

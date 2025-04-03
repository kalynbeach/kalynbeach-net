import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

// TODO: update or remove this component

export default function SiteSignOut() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm" className="">
        sign out
      </Button>
    </form>
  );
}

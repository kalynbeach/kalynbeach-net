import { githubLogin } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default function SiteSignIn() {
  return (
    <form action={githubLogin}>
      <Button type="submit" variant="outline" size="sm" className="font-mono">
        login
      </Button>
    </form>
  );
}

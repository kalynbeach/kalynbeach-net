import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <Button type="submit" variant="outline" size="sm" className="">
        sign out
      </Button>
    </form>
  );
}

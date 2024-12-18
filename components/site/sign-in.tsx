import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/dist/server/api-utils";

export default function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/dashboard" });
      }}
    >
      <Button type="submit" variant="outline" size="sm" className="">
        sign in
      </Button>
    </form>
  );
}

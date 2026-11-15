import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/site";

export default function SiteSignIn() {
  return (
    <Button
      render={<Link href={signIn.route} />}
      nativeButton={false}
      variant="outline"
      size="sm"
      className="font-mono"
    >
      login
    </Button>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SiteSignIn() {
  return (
    <Button
      render={<Link href="/login" />}
      nativeButton={false}
      variant="outline"
      size="sm"
      className="font-mono"
    >
      login
    </Button>
  );
}

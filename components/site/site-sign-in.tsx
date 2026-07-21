import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SiteSignIn() {
  return (
    <Button asChild variant="outline" size="sm" className="font-mono">
      <Link href="/login">login</Link>
    </Button>
  );
}

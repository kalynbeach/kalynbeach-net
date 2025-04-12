import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "unauthorized",
};

export default function Unauthorized() {
  return (
    <SitePage>
      <main className="size-full flex flex-col gap-4">
        <p className="text-sm font-mono font-medium">
          you do not have permission to access this page {" -> "}
          <Link
            href="/login"
            className="font-medium underline"
          >
            login
          </Link>
        </p>
      </main>
    </SitePage>
  );
} 
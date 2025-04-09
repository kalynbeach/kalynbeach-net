import Link from "next/link";
import SitePageHeader from "@/components/site/site-page-header";

export default function Unauthorized() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader />
      <div className="w-full flex flex-col gap-4">
        <p className="text-sm font-mono font-medium">
          you do not have permission to access this page {" -> "}
          <Link
            href="/login"
            className="font-medium underline"
          >
            login
          </Link>
        </p>
      </div>
    </div>
  );
} 
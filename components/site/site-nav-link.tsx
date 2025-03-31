import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SitePage } from "@/lib/types/site";

type SiteNavLinkProps = {
  page: SitePage;
  isActive: boolean;
  onClick?: () => void;
};

export default function SiteNavLink({ page, isActive, onClick }: SiteNavLinkProps) {
  return (
    <Link
      key={page.route}
      href={page.route}
      className={cn(
        "text-sm font-mono font-semibold dark:font-normal",
        "transition-colors duration-200 hover:text-kb-blue dark:hover:text-kb-green",
        `${isActive && "text-kb-blue dark:text-kb-green"}`
      )}
      onClick={onClick}
    >
      {page.label}
    </Link>
  );
}

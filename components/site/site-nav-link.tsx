import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SitePage } from "@/lib/types/site";

type SiteNavLinkProps = {
  page: SitePage;
  isActive: boolean;
  onClick?: () => void;
};

export default function SiteNavLink({
  page,
  isActive,
  onClick,
}: SiteNavLinkProps) {
  return (
    <Link
      key={page.route}
      href={page.route}
      className={cn(
        "font-mono font-semibold sm:text-sm dark:font-medium",
        "transition-colors duration-150 hover:text-signal",
        isActive && "text-signal"
      )}
      onClick={onClick}
    >
      {page.label}
    </Link>
  );
}

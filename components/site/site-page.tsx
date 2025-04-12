import { cn } from "@/lib/utils";
import SitePageHeader from "@/components/site/site-page-header";

type SitePageProps = {
  children: React.ReactNode;
  className?: string;
  includeHeader?: boolean;
};

export default function SitePage({
  children,
  className,
  includeHeader = true,
}: SitePageProps) {
  return (
    <div className={cn("site-page size-full flex flex-col items-start justify-start gap-6", className)}>
      {includeHeader && <SitePageHeader />}
      {children}
    </div>
  );
}
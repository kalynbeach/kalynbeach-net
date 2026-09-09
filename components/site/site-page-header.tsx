import { Suspense } from "react";
import { Loader } from "lucide-react";
import SiteBreadcrumb from "./site-breadcrumb";

type SitePageHeaderProps = {
  children?: React.ReactNode;
};

export default function SitePageHeader({ children }: SitePageHeaderProps) {
  return (
    <div className="site-page-header flex h-20 min-h-20 w-full flex-row items-center justify-between gap-4 md:h-24 md:min-h-24">
      <Suspense fallback={<Loader className="size-5 animate-spin" />}>
        <SiteBreadcrumb />
      </Suspense>
      {children}
    </div>
  );
}

"use client";

import { unstable_ViewTransition as ViewTransition } from "react";
import { usePathname } from "next/navigation";
import SiteLogo from "./site-logo";

export default function SiteFooterLogo() {
  const pathname = usePathname();

  return (
    <div className="flex flex-row items-center justify-center">
      {pathname !== "/" && (
        <ViewTransition name="site-logo">
          <SiteLogo className="size-12" />
        </ViewTransition>
      )}
    </div>
  );
}
"use client";

import { unstable_ViewTransition as ViewTransition } from "react";
import { usePathname } from "next/navigation";
import SiteSphere from "./site-sphere";

export default function SiteFooterLogo() {
  const pathname = usePathname();

  return (
    <div className="flex flex-row items-center justify-center">
      {/* Don't render the sphere on the home page since it's already rendered in <main> */}
      {pathname !== "/" && (
        <ViewTransition name="site-sphere">
          <SiteSphere className="size-12" />
        </ViewTransition>
      )}
    </div>
  );
}
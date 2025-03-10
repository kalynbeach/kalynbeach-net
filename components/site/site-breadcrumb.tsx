"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function SiteBreadcrumb() {
  const pathname = usePathname();
  const pathnameParts = pathname.split("/").filter(Boolean);

  return (
    <div className="site-breadcrumb w-full h-20 md:h-24 font-mono">
      <Breadcrumb>
        <BreadcrumbList>
          {pathnameParts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === pathnameParts.length - 1 ? (
                  <BreadcrumbPage>
                    <span className="text-lg md:text-xl font-mono font-semibold">
                      {part}
                    </span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={`/${part}`}>
                    <span className="text-lg md:text-xl font-mono font-semibold">
                      {part}
                    </span>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
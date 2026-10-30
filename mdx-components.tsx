import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";

/**
 * Every content/*.mdx body renders in Kevelle's typeset at the body role.
 * Typeset styles markdown's elements and skips any subtree whose root has a
 * data-slot, so a component used in MDX keeps its own type by setting one.
 * Components every content file uses are registered here; the rest are
 * imported by the file that uses them.
 */
const components = {
  // Prose takes typeset's flow. The header and components keep section 1's
  // 32px gap between blocks above and below them.
  wrapper: ({ children }: { children: ReactNode }) => (
    <div className="typeset role-body text-ramp-8 [&>*+[data-slot]]:mt-8 [&>[data-slot]+*]:mt-8">
      {children}
    </div>
  ),
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) =>
    // A site path navigates client-side. "//host" is protocol-relative, so it leaves the site.
    href.startsWith("/") && !href.startsWith("//") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} {...props} />
    ),
  PageHeader,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}

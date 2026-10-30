import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Project } from "@/components/site/project";

/**
 * Every content/*.mdx body renders in Kevelle's typeset with the site's
 * preset, typeset-site in app/globals.css, which sets markdown in the site's
 * type scale. Typeset skips any subtree whose root has a data-slot, so a
 * component used in MDX keeps its own type by setting one. PageHeader (every
 * content file) and Project (the Software index) are registered here; other
 * components are imported by the file that uses them.
 */
const components = {
  wrapper: ({ children }: { children: ReactNode }) => (
    <div className="typeset typeset-site">{children}</div>
  ),
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) =>
    // A site path navigates client-side. "//host" is protocol-relative, so it leaves the site.
    href.startsWith("/") && !href.startsWith("//") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} {...props} />
    ),
  PageHeader,
  Project,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}

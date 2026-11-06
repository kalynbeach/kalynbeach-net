/**
 * A content file's exports: the body, and its page's metadata (the title,
 * and the lede as the description). The default export repeats @types/mdx's
 * because without it this declaration hides that one.
 */
declare module "*.mdx" {
  import type { Element, MDXProps } from "mdx/types";
  import type { PageMeta } from "@/lib/site";

  export default function MDXContent(props: MDXProps): Element;
  export const metadata: PageMeta;
}

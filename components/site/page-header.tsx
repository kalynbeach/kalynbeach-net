import type { ReactNode } from "react";
import type { PageMeta } from "@/lib/site";

/**
 * A page's title, its lede, and its facts, a meta line or a stat row passed
 * as children. It is section 1's first element on every page but Home, so
 * the title's cap top sits on the top line beside the name's. Each content
 * file renders it first, from its metadata: `<PageHeader {...metadata} />`.
 * The shell renders it for system and not-found pages. The prop is
 * `description` because the lede is the meta description.
 *
 * role-title trims only the title's top, and nothing below 1200px, so its
 * line box ends below the text. The lede sits 16 under it and the facts 24
 * under the lede, as drawn.
 */
export function PageHeader({
  title,
  description,
  children,
}: PageMeta & { children?: ReactNode }) {
  return (
    <header data-slot="page-header" className="flex flex-col">
      <h1 data-slot="page-title" className="role-title text-ramp-10">
        {title}
      </h1>
      {description && (
        <p data-slot="page-lede" className="role-lede text-ramp-7 mt-4">
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}

/** A line of facts, a caption or a block's label. */
export function Meta({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} data-slot="meta" className="role-mono-sm text-ramp-7">
      {children}
    </p>
  );
}

import type { PageMeta } from "@/lib/site";

/**
 * A page's title and lede. It is section 1's first element on every page but
 * Home, so the title's cap top sits on the top line beside the name's. Each
 * content file renders it first, from its metadata: `<PageHeader
 * {...metadata} />`. The shell renders it for system and not-found pages.
 * The prop is `description` because the lede is the meta description.
 */
export function PageHeader({ title, description }: PageMeta) {
  return (
    <hgroup data-slot="page-header" className="flex flex-col gap-5">
      <h1 data-slot="page-title" className="role-title text-ramp-10">
        {title}
      </h1>
      {description && (
        <p
          data-slot="page-lede"
          className="role-lede max-w-measure text-ramp-7"
        >
          {description}
        </p>
      )}
    </hgroup>
  );
}

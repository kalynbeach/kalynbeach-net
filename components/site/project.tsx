import Link from "next/link";

/**
 * A project's section on the Software index: its title as a linked heading,
 * then its lede. Both come from content/software/<slug>.mdx's metadata, so
 * the index never repeats a project's copy. It renders a plain h2 and p, with
 * no data-slot, so typeset sets it like the index's `##` sections.
 *
 * The link keeps typeset's focus ring but takes the heading's ink, so a
 * linked title reads as one of the index's headings. Only its 1px ramp-6
 * underline, 5 under the text and 3:1 against the page in both themes,
 * marks it as a link, and hover inks the underline.
 */
export async function Project({ slug }: { slug: string }) {
  const { metadata }: typeof import("*.mdx") = await import(
    `@/content/software/${slug}.mdx`
  );
  return (
    <>
      <h2>
        <Link
          href={`/software/${slug}`}
          className="decoration-ramp-6 text-inherit decoration-1 underline-offset-5 [text-underline-position:auto] hover:decoration-current"
        >
          {metadata.title}
        </Link>
      </h2>
      {metadata.description && <p>{metadata.description}</p>}
    </>
  );
}

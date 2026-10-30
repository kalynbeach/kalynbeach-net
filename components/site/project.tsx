import Link from "next/link";

/**
 * A project's section on the Software index: its title as a linked heading,
 * then its lede. Both come from content/software/<slug>.mdx's metadata, so
 * the index never repeats a project's copy. It renders a plain h2 and p, with
 * no data-slot, so typeset sets it like the index's `##` sections.
 */
export async function Project({ slug }: { slug: string }) {
  const { metadata }: typeof import("*.mdx") = await import(
    `@/content/software/${slug}.mdx`
  );
  return (
    <>
      <h2>
        <Link href={`/software/${slug}`}>{metadata.title}</Link>
      </h2>
      {metadata.description && <p>{metadata.description}</p>}
    </>
  );
}

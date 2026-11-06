import Link from "next/link";

/**
 * Temporary: components/site/project.tsx for content/drafts/*.mdx, which
 * import it. It renders an h3, a subsection of the Projects section.
 */
export async function DraftProject({ slug }: { slug: string }) {
  const { metadata }: typeof import("*.mdx") = await import(
    `@/content/drafts/${slug}.mdx`
  );
  return (
    <>
      <h3>
        <Link
          href={`/drafts/${slug}`}
          className="decoration-ramp-6 text-inherit decoration-1 underline-offset-5 [text-underline-position:auto] hover:decoration-current"
        >
          {metadata.title}
        </Link>
      </h3>
      {metadata.description && <p>{metadata.description}</p>}
    </>
  );
}

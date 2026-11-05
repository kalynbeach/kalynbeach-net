import Link from "next/link";

/** Temporary: components/site/project.tsx for content/drafts/*.mdx, which import it. */
export async function DraftProject({ slug }: { slug: string }) {
  const { metadata }: typeof import("*.mdx") = await import(
    `@/content/drafts/${slug}.mdx`
  );
  return (
    <>
      <h2>
        <Link
          href={`/drafts/${slug}`}
          className="decoration-ramp-6 text-inherit decoration-1 underline-offset-5 [text-underline-position:auto] hover:decoration-current"
        >
          {metadata.title}
        </Link>
      </h2>
      {metadata.description && <p>{metadata.description}</p>}
    </>
  );
}

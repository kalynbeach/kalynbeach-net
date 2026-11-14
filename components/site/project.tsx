import Link from "next/link";
import { metadata as agents } from "@/content/software/agents.mdx?metadata";
import { metadata as kkbAudio } from "@/content/software/kkb-audio.mdx?metadata";
import type { PageMeta, ProjectSlug } from "@/lib/site";

/**
 * Each project's metadata. A `?metadata` import holds only the file's
 * metadata export (tools/mdx/metadata-loader.ts), so the pages that register
 * Project never load the components a project's body renders.
 */
const projects = {
  agents,
  "kkb-audio": kkbAudio,
} satisfies Record<ProjectSlug, PageMeta>;

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
export function Project({ slug }: { slug: ProjectSlug }) {
  const metadata = projects[slug];
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

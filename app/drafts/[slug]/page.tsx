import { readdirSync } from "node:fs";
import type { Metadata } from "next";

// Temporary: previews of copy variants, removed with content/drafts/ once Kalyn picks.

type Props = { params: Promise<{ slug: string }> };

/** One page per content/drafts/<slug>.mdx, read at build time. Any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return readdirSync("content/drafts")
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => ({ slug: file.slice(0, -".mdx".length) }));
}

async function content({ params }: Props) {
  const { slug } = await params;
  const draft: typeof import("*.mdx") = await import(
    `@/content/drafts/${slug}.mdx`
  );
  return { slug, draft };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, draft } = await content(props);
  return {
    ...draft.metadata,
    title: `${draft.metadata.title} (draft ${slug})`,
    robots: { index: false, follow: false },
  };
}

export default async function DraftPage(props: Props) {
  const {
    draft: { default: Content },
  } = await content(props);
  return <Content />;
}

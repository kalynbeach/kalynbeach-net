import { readdirSync } from "node:fs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Temporary: previews of copy variants, removed with content/drafts/ once Kalyn picks.

type Props = { params: Promise<{ slug: string }> };

/** Slugs without a content/drafts/<slug>.mdx file are a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return readdirSync("content/drafts")
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => ({ slug: file.slice(0, -".mdx".length) }));
}

async function content({ params }: Props) {
  const { slug } = await params;
  if (!generateStaticParams().some((draft) => draft.slug === slug)) notFound();
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projectSlugs, servedProjectSlugs } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

/**
 * One page per project in the site map, prerendered. proxy.ts answers any
 * other slug, or an unserved project, with a 404 per request. The check in
 * content() keeps an unserved project's content out of the build.
 */
export function generateStaticParams() {
  return projectSlugs.map((slug) => ({ slug }));
}

async function content({ params }: Props): Promise<typeof import("*.mdx")> {
  const { slug } = await params;
  if (!servedProjectSlugs.some((served) => served === slug)) notFound();
  return import(`@/content/software/${slug}.mdx`);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await content(props)).metadata;
}

export default async function ProjectPage(props: Props) {
  const { default: Content } = await content(props);
  return <Content />;
}

import type { Metadata } from "next";
import { projects } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

/** One page per project in the site map. Any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((slug) => ({ slug }));
}

async function content({ params }: Props): Promise<typeof import("*.mdx")> {
  const { slug } = await params;
  return import(`@/content/software/${slug}.mdx`);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await content(props)).metadata;
}

export default async function ProjectPage(props: Props) {
  const { default: Content } = await content(props);
  return <Content />;
}

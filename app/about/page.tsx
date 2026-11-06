import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Content, { metadata as page } from "@/content/about.mdx";
import { served } from "@/lib/site";

const isServed = served("/about");

/**
 * An unserved page sets no metadata, so its 404 keeps the root layout's
 * title. notFound() alone leaves the page's title on a client navigation,
 * because Next resolves metadata apart from the page's render.
 */
export const metadata: Metadata = isServed ? page : {};

export default function AboutPage() {
  if (!isServed) notFound();
  return <Content />;
}

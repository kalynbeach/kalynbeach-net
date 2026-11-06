import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Content, { metadata as page } from "@/content/sound.mdx";
import { served } from "@/lib/site";

const isServed = served("/sound");

/**
 * An unserved page sets no metadata, so its 404 keeps the root layout's
 * title. notFound() alone leaves the page's title on a client navigation,
 * because Next resolves metadata apart from the page's render.
 */
export const metadata: Metadata = isServed ? page : {};

export default function SoundPage() {
  if (!isServed) notFound();
  return <Content />;
}
